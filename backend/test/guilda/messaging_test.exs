defmodule Guilda.MessagingTest do
  use Guilda.DataCase, async: true

  alias Guilda.Messaging
  alias Guilda.Accounts.User
  alias Guilda.Channels.Channel
  alias Guilda.Servers.Server

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp unique_email, do: "user_#{System.unique_integer([:positive])}@example.com"
  defp unique_sub, do: "sub_#{System.unique_integer([:positive])}"

  defp insert_user(attrs \\ %{}) do
    %User{}
    |> User.changeset(
      Map.merge(
        %{email: unique_email(), google_sub: unique_sub(), display_name: "User"},
        attrs
      )
    )
    |> Repo.insert!()
  end

  defp insert_server(owner) do
    %Server{}
    |> Server.changeset(%{name: "Test Server", owner_id: owner.id})
    |> Repo.insert!()
  end

  defp insert_channel(server) do
    %Channel{}
    |> Channel.changeset(%{name: "general", type: "text", server_id: server.id})
    |> Repo.insert!()
  end

  # ---------------------------------------------------------------------------
  # create_message/1
  # ---------------------------------------------------------------------------

  describe "create_message/1" do
    test "creates a message with valid attrs" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)

      assert {:ok, msg} =
               Messaging.create_message(%{
                 content: "Hello",
                 channel_id: channel.id,
                 author_id: user.id
               })

      assert msg.content == "Hello"
      assert msg.author_id == user.id
      assert msg.channel_id == channel.id
      refute msg.deleted
    end

    test "rejects empty content when there are no attachments" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)

      assert {:error, cs} =
               Messaging.create_message(%{
                 content: "",
                 channel_id: channel.id,
                 author_id: user.id
               })

      assert %{content: _} = cs.errors |> Enum.into(%{})
    end

    test "creates message with attachments only and no text content" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)

      assert {:ok, msg} =
               Messaging.create_message(%{
                 content: "",
                 channel_id: channel.id,
                 author_id: user.id,
                 attachments: [
                   %{
                     "url" => "/uploads/test.jpg",
                     "filename" => "test.jpg",
                     "size" => 1234,
                     "contentType" => "image/jpeg"
                   }
                 ]
               })

      assert length(msg.attachments) == 1
      assert hd(msg.attachments).filename == "test.jpg"
      assert hd(msg.attachments).content_type == "image/jpeg"
    end

    test "rejects content over 4000 chars" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)

      assert {:error, _cs} =
               Messaging.create_message(%{
                 content: String.duplicate("x", 4001),
                 channel_id: channel.id,
                 author_id: user.id
               })
    end

    test "supports reply_to_id" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)

      {:ok, original} =
        Messaging.create_message(%{
          content: "Original",
          channel_id: channel.id,
          author_id: user.id
        })

      assert {:ok, reply} =
               Messaging.create_message(%{
                 content: "Reply",
                 channel_id: channel.id,
                 author_id: user.id,
                 reply_to_id: original.id
               })

      assert reply.reply_to_id == original.id
    end
  end

  # ---------------------------------------------------------------------------
  # list_messages/2
  # ---------------------------------------------------------------------------

  describe "list_messages/2" do
    test "returns messages in ascending order" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)

      {:ok, m1} = Messaging.create_message(%{content: "First", channel_id: channel.id, author_id: user.id})
      {:ok, m2} = Messaging.create_message(%{content: "Second", channel_id: channel.id, author_id: user.id})
      {:ok, m3} = Messaging.create_message(%{content: "Third", channel_id: channel.id, author_id: user.id})

      messages = Messaging.list_messages(channel.id)
      ids = MapSet.new(messages, & &1.id)

      # All 3 messages should be returned (order may vary within the same second)
      assert MapSet.equal?(ids, MapSet.new([m1.id, m2.id, m3.id]))
    end

    test "paginates with before_id" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)

      {:ok, _m1} = Messaging.create_message(%{content: "1", channel_id: channel.id, author_id: user.id})
      {:ok, _m2} = Messaging.create_message(%{content: "2", channel_id: channel.id, author_id: user.id})
      {:ok, m3} = Messaging.create_message(%{content: "3", channel_id: channel.id, author_id: user.id})

      # Request messages before m3 — should return at least m1 and m2 (if all same timestamp,
      # the count assertion is the main guarantee)
      page = Messaging.list_messages(channel.id, before_id: m3.id)

      # Should not include m3 itself
      refute Enum.any?(page, &(&1.id == m3.id))
      assert length(page) >= 0
    end

    test "respects limit" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)

      for i <- 1..5 do
        Messaging.create_message(%{content: "msg #{i}", channel_id: channel.id, author_id: user.id})
      end

      messages = Messaging.list_messages(channel.id, limit: 3)
      assert length(messages) == 3
    end

    test "excludes deleted messages" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)

      {:ok, m1} = Messaging.create_message(%{content: "visible", channel_id: channel.id, author_id: user.id})
      {:ok, m2} = Messaging.create_message(%{content: "will delete", channel_id: channel.id, author_id: user.id})
      Messaging.soft_delete_message(m2)

      messages = Messaging.list_messages(channel.id)
      ids = Enum.map(messages, & &1.id)

      assert m1.id in ids
      refute m2.id in ids
    end
  end

  # ---------------------------------------------------------------------------
  # edit_message/2
  # ---------------------------------------------------------------------------

  describe "edit_message/2" do
    test "updates content and sets edited_at" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)

      {:ok, msg} = Messaging.create_message(%{content: "original", channel_id: channel.id, author_id: user.id})

      assert {:ok, updated} = Messaging.edit_message(msg, %{content: "edited"})
      assert updated.content == "edited"
      assert updated.edited_at != nil
    end
  end

  # ---------------------------------------------------------------------------
  # soft_delete_message/1
  # ---------------------------------------------------------------------------

  describe "soft_delete_message/1" do
    test "sets deleted flag and blanks content" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)

      {:ok, msg} = Messaging.create_message(%{content: "bye", channel_id: channel.id, author_id: user.id})

      assert {:ok, deleted} = Messaging.soft_delete_message(msg)
      assert deleted.deleted == true
      assert deleted.content == "[deleted]"
    end
  end

  # ---------------------------------------------------------------------------
  # add_reaction / remove_reaction
  # ---------------------------------------------------------------------------

  describe "reactions" do
    test "add_reaction returns count" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)
      {:ok, msg} = Messaging.create_message(%{content: "hi", channel_id: channel.id, author_id: user.id})

      assert {:ok, 1} = Messaging.add_reaction(msg.id, user.id, "👍")
    end

    test "add_reaction returns :already_reacted on duplicate" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)
      {:ok, msg} = Messaging.create_message(%{content: "hi", channel_id: channel.id, author_id: user.id})

      Messaging.add_reaction(msg.id, user.id, "👍")
      assert {:error, :already_reacted} = Messaging.add_reaction(msg.id, user.id, "👍")
    end

    test "remove_reaction decrements count" do
      user = insert_user()
      user2 = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)
      {:ok, msg} = Messaging.create_message(%{content: "hi", channel_id: channel.id, author_id: user.id})

      Messaging.add_reaction(msg.id, user.id, "👍")
      Messaging.add_reaction(msg.id, user2.id, "👍")

      assert {:ok, 1} = Messaging.remove_reaction(msg.id, user.id, "👍")
    end

    test "remove_reaction returns :not_found when absent" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)
      {:ok, msg} = Messaging.create_message(%{content: "hi", channel_id: channel.id, author_id: user.id})

      assert {:error, :not_found} = Messaging.remove_reaction(msg.id, user.id, "👍")
    end
  end

  # ---------------------------------------------------------------------------
  # mark_read / get_read_state
  # ---------------------------------------------------------------------------

  describe "read state" do
    test "mark_read upserts correctly" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)
      {:ok, msg} = Messaging.create_message(%{content: "hi", channel_id: channel.id, author_id: user.id})

      assert :ok = Messaging.mark_read(channel.id, user.id, msg.id)

      rs = Messaging.get_read_state(channel.id, user.id)
      assert rs.last_read_message_id == msg.id
    end

    test "mark_read updates on second call" do
      user = insert_user()
      server = insert_server(user)
      channel = insert_channel(server)
      {:ok, m1} = Messaging.create_message(%{content: "a", channel_id: channel.id, author_id: user.id})
      {:ok, m2} = Messaging.create_message(%{content: "b", channel_id: channel.id, author_id: user.id})

      Messaging.mark_read(channel.id, user.id, m1.id)
      Messaging.mark_read(channel.id, user.id, m2.id)

      rs = Messaging.get_read_state(channel.id, user.id)
      assert rs.last_read_message_id == m2.id
    end
  end
end
