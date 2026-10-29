defmodule GuildaWeb.ChannelChannelTest do
  use ExUnit.Case, async: false

  import Phoenix.ChannelTest
  alias Guilda.Repo
  alias Guilda.Accounts
  alias Guilda.Accounts.User
  alias Guilda.Servers
  alias Guilda.Channels
  alias Guilda.Messaging
  alias GuildaWeb.UserSocket

  @endpoint GuildaWeb.Endpoint

  # ---------------------------------------------------------------------------
  # Setup
  # ---------------------------------------------------------------------------

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)
    Ecto.Adapters.SQL.Sandbox.mode(Repo, {:shared, self()})

    # Create owner and a second user
    owner = insert_user("owner@test.com")
    other = insert_user("other@test.com")

    # Create session tokens
    owner_token = create_session_token(owner)
    other_token = create_session_token(other)

    # Create server (owner is owner)
    {:ok, server} = Servers.create_server(owner, %{name: "Test Server"})

    # Add other as member (assigns default "member" role automatically)
    {:ok, _} = Servers.add_member(server, other)

    # Fetch memberships
    owner_membership = Servers.get_membership(server, owner)
    other_membership = Servers.get_membership(server, other)

    # Create a channel without a category (category_id is optional)
    {:ok, channel} =
      Channels.create_channel(server, %{
        name: "general",
        type: "text"
      })

    {:ok,
     owner: owner,
     other: other,
     owner_token: owner_token,
     other_token: other_token,
     server: server,
     channel: channel,
     owner_membership: owner_membership,
     other_membership: other_membership}
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp insert_user(email) do
    %User{}
    |> User.changeset(%{
      email: email,
      google_sub: "sub_#{System.unique_integer([:positive])}",
      display_name: "User #{email}"
    })
    |> Repo.insert!()
  end

  defp create_session_token(user) do
    {:ok, {raw_token, _session}} = Accounts.create_session(user)
    raw_token
  end

  defp connect_as(token) do
    {:ok, socket} = connect(UserSocket, %{"token" => token})
    socket
  end

  # ---------------------------------------------------------------------------
  # Tests
  # ---------------------------------------------------------------------------

  describe "join channel:" do
    test "owner can join", %{owner: _, owner_token: token, channel: channel} do
      socket = connect_as(token)
      assert {:ok, _reply, _joined_socket} = subscribe_and_join(socket, "channel:#{channel.id}", %{})
    end

    test "member can join", %{other_token: token, channel: channel} do
      socket = connect_as(token)
      assert {:ok, _reply, _} = subscribe_and_join(socket, "channel:#{channel.id}", %{})
    end

    test "unauthenticated user cannot join", %{channel: channel} do
      {:ok, socket} = connect(UserSocket, %{})
      assert {:error, %{reason: "unauthenticated"}} =
               subscribe_and_join(socket, "channel:#{channel.id}", %{})
    end

    test "join reply includes last_read_message_id", %{owner_token: token, channel: channel} do
      socket = connect_as(token)
      assert {:ok, %{last_read_message_id: nil}, _} =
               subscribe_and_join(socket, "channel:#{channel.id}", %{})
    end
  end

  describe "new_message" do
    test "broadcasts to all subscribers", %{
      owner_token: owner_token,
      other_token: other_token,
      channel: channel
    } do
      owner_socket = connect_as(owner_token)
      {:ok, _, owner_joined} = subscribe_and_join(owner_socket, "channel:#{channel.id}", %{})

      other_socket = connect_as(other_token)
      {:ok, _, _} = subscribe_and_join(other_socket, "channel:#{channel.id}", %{})

      ref = push(owner_joined, "new_message", %{"content" => "Hello world"})
      assert_reply ref, :ok, %{id: _}
      assert_broadcast "new_message", %{content: "Hello world"}
    end

    test "returns error for empty content", %{owner_token: token, channel: channel} do
      socket = connect_as(token)
      {:ok, _, joined} = subscribe_and_join(socket, "channel:#{channel.id}", %{})

      ref = push(joined, "new_message", %{"content" => ""})
      assert_reply ref, :error, %{reason: _}
    end
  end
  describe "polls channel" do
    test "can be joined but rejects chat messages", %{owner_token: token, server: server} do
      {:ok, polls_channel} = Channels.create_channel(server, %{name: "enquetes", type: "polls"})

      socket = connect_as(token)
      assert {:ok, _, joined} = subscribe_and_join(socket, "channel:#{polls_channel.id}", %{})

      ref = push(joined, "new_message", %{"content" => "oi"})
      assert_reply ref, :error, %{reason: "channel_does_not_accept_messages"}
      assert Messaging.list_messages(polls_channel.id) == []
    end
  end



  describe "edit_message" do
    test "author can edit own message", %{owner_token: token, owner: owner, channel: channel} do
      {:ok, msg} =
        Messaging.create_message(%{
          content: "original",
          channel_id: channel.id,
          author_id: owner.id
        })

      socket = connect_as(token)
      {:ok, _, joined} = subscribe_and_join(socket, "channel:#{channel.id}", %{})

      ref = push(joined, "edit_message", %{"message_id" => msg.id, "content" => "edited"})
      assert_reply ref, :ok
      assert_broadcast "message_edited", %{id: _, content: "edited"}
    end

    test "non-author cannot edit message", %{
      other_token: other_token,
      owner: owner,
      channel: channel
    } do
      {:ok, msg} =
        Messaging.create_message(%{
          content: "owner's message",
          channel_id: channel.id,
          author_id: owner.id
        })

      socket = connect_as(other_token)
      {:ok, _, joined} = subscribe_and_join(socket, "channel:#{channel.id}", %{})

      ref = push(joined, "edit_message", %{"message_id" => msg.id, "content" => "hacked"})
      assert_reply ref, :error, %{reason: "not_author"}
    end
  end

  describe "delete_message" do
    test "author can delete own message", %{owner_token: token, owner: owner, channel: channel} do
      {:ok, msg} =
        Messaging.create_message(%{
          content: "delete me",
          channel_id: channel.id,
          author_id: owner.id
        })

      socket = connect_as(token)
      {:ok, _, joined} = subscribe_and_join(socket, "channel:#{channel.id}", %{})

      ref = push(joined, "delete_message", %{"message_id" => msg.id})
      assert_reply ref, :ok
      assert_broadcast "message_deleted", %{id: _}
    end

    test "non-author cannot delete another user's message without permission", %{
      other_token: other_token,
      owner: owner,
      channel: channel
    } do
      {:ok, msg} =
        Messaging.create_message(%{
          content: "owner's message",
          channel_id: channel.id,
          author_id: owner.id
        })

      socket = connect_as(other_token)
      {:ok, _, joined} = subscribe_and_join(socket, "channel:#{channel.id}", %{})

      ref = push(joined, "delete_message", %{"message_id" => msg.id})
      assert_reply ref, :error, %{reason: "insufficient_permissions"}
    end
  end

  describe "reactions" do
    test "add and remove reaction", %{
      owner_token: token,
      owner: owner,
      channel: channel
    } do
      {:ok, msg} =
        Messaging.create_message(%{content: "react to me", channel_id: channel.id, author_id: owner.id})

      socket = connect_as(token)
      {:ok, _, joined} = subscribe_and_join(socket, "channel:#{channel.id}", %{})

      ref = push(joined, "add_reaction", %{"message_id" => msg.id, "emoji" => "👍"})
      assert_reply ref, :ok
      assert_broadcast "reaction_added", %{emoji: "👍", count: 1}

      ref2 = push(joined, "remove_reaction", %{"message_id" => msg.id, "emoji" => "👍"})
      assert_reply ref2, :ok
      assert_broadcast "reaction_removed", %{emoji: "👍", count: 0}
    end
  end

  describe "typing indicators" do
    test "typing_start broadcasts to other subscribers", %{
      owner_token: owner_token,
      other_token: other_token,
      channel: channel
    } do
      owner_socket = connect_as(owner_token)
      {:ok, _, owner_joined} = subscribe_and_join(owner_socket, "channel:#{channel.id}", %{})

      other_socket = connect_as(other_token)
      {:ok, _, _} = subscribe_and_join(other_socket, "channel:#{channel.id}", %{})

      push(owner_joined, "typing_start", %{})
      assert_broadcast "typing", %{typing: true}
    end
  end

  describe "mark_read" do
    test "persists read state", %{owner_token: token, owner: owner, channel: channel} do
      {:ok, msg} =
        Messaging.create_message(%{content: "read me", channel_id: channel.id, author_id: owner.id})

      socket = connect_as(token)
      {:ok, _, joined} = subscribe_and_join(socket, "channel:#{channel.id}", %{})

      ref = push(joined, "mark_read", %{"message_id" => msg.id})
      assert_reply ref, :ok

      rs = Messaging.get_read_state(channel.id, owner.id)
      assert rs.last_read_message_id == msg.id
    end
  end
end
