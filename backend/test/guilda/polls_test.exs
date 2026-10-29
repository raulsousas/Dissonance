defmodule Guilda.PollsTest do
  use Guilda.DataCase, async: true

  alias Guilda.Accounts.User
  alias Guilda.{Channels, DirectMessaging, Polls, Servers}

  defp insert_user do
    n = System.unique_integer([:positive])

    %User{}
    |> User.changeset(%{
      email: "poll_user_#{n}@example.com",
      google_sub: "poll_sub_#{n}",
      display_name: "Poll User #{n}"
    })
    |> Repo.insert!()
  end

  defp setup_channel(owner) do
    {:ok, server} = Servers.create_server(owner, %{name: "Poll Server"})
    channel = hd(Channels.list_channels(server))
    {server, channel}
  end

  defp poll_attrs(channel_id, overrides \\ %{}) do
    Map.merge(
      %{
        "scope" => "channel",
        "channel_id" => channel_id,
        "title" => "Quando é a raid?",
        "options" => ["Sábado", "Domingo"],
        "allow_suggestions" => true,
        "multiple_choice" => false,
        "allow_comments" => true
      },
      overrides
    )
  end

  defp vote_ids(poll, text) do
    poll.votes
    |> Enum.filter(fn v -> Enum.find(poll.options, &(&1.id == v.option_id)).text == text end)
    |> Enum.map(& &1.user_id)
  end

  defp option_id(poll, text), do: Enum.find(poll.options, &(&1.text == text)).id

  describe "create_poll/2" do
    test "creates a poll with options for a server member" do
      owner = insert_user()
      {_server, channel} = setup_channel(owner)

      assert {:ok, poll} = Polls.create_poll(owner, poll_attrs(channel.id))
      assert poll.title == "Quando é a raid?"
      assert Enum.map(poll.options, & &1.text) == ["Sábado", "Domingo"]
    end

    test "rejects users that are not members of the server" do
      owner = insert_user()
      outsider = insert_user()
      {_server, channel} = setup_channel(owner)

      assert {:error, :forbidden} = Polls.create_poll(outsider, poll_attrs(channel.id))
    end

    test "requires between 2 and 10 non-blank options" do
      owner = insert_user()
      {_server, channel} = setup_channel(owner)

      assert {:error, :invalid_options} =
               Polls.create_poll(owner, poll_attrs(channel.id, %{"options" => ["Só uma", "  "]}))

      many = Enum.map(1..11, &"Opção #{&1}")

      assert {:error, :invalid_options} =
               Polls.create_poll(owner, poll_attrs(channel.id, %{"options" => many}))
    end

    test "rejects a non-UUID channel id" do
      owner = insert_user()
      assert {:error, :forbidden} = Polls.create_poll(owner, poll_attrs("not-a-uuid"))
    end

    test "works in direct message conversations for members only" do
      a = insert_user()
      b = insert_user()
      outsider = insert_user()
      {:ok, conv} = DirectMessaging.get_or_create_conversation(a.id, b.id)

      attrs = poll_attrs(conv.id, %{"scope" => "dm"})
      assert {:ok, _} = Polls.create_poll(b, attrs)
      assert {:error, :forbidden} = Polls.create_poll(outsider, attrs)
    end
  end

  describe "toggle_vote/3" do
    setup do
      owner = insert_user()
      {server, channel} = setup_channel(owner)
      %{owner: owner, server: server, channel: channel}
    end

    test "single choice moves the vote and toggles it off", %{owner: owner, channel: channel} do
      {:ok, poll} = Polls.create_poll(owner, poll_attrs(channel.id))

      {:ok, poll} = Polls.toggle_vote(owner, poll, option_id(poll, "Sábado"))
      assert vote_ids(poll, "Sábado") == [owner.id]

      {:ok, poll} = Polls.toggle_vote(owner, poll, option_id(poll, "Domingo"))
      assert vote_ids(poll, "Sábado") == []
      assert vote_ids(poll, "Domingo") == [owner.id]

      {:ok, poll} = Polls.toggle_vote(owner, poll, option_id(poll, "Domingo"))
      assert poll.votes == []
    end

    test "multiple choice keeps votes on several options", %{owner: owner, channel: channel} do
      {:ok, poll} =
        Polls.create_poll(owner, poll_attrs(channel.id, %{"multiple_choice" => true}))

      {:ok, poll} = Polls.toggle_vote(owner, poll, option_id(poll, "Sábado"))
      {:ok, poll} = Polls.toggle_vote(owner, poll, option_id(poll, "Domingo"))
      assert length(poll.votes) == 2
    end

    test "votes from other members are visible to everyone", %{
      owner: owner,
      server: server,
      channel: channel
    } do
      other = insert_user()
      {:ok, _} = join(server, other)

      {:ok, poll} = Polls.create_poll(owner, poll_attrs(channel.id))
      {:ok, _} = Polls.toggle_vote(owner, poll, option_id(poll, "Sábado"))
      {:ok, poll} = Polls.toggle_vote(other, poll, option_id(poll, "Sábado"))

      assert Enum.sort(vote_ids(poll, "Sábado")) == Enum.sort([owner.id, other.id])
    end

    test "rejects votes on closed polls and unknown options", %{owner: owner, channel: channel} do
      {:ok, poll} = Polls.create_poll(owner, poll_attrs(channel.id))

      assert {:error, :not_found} = Polls.toggle_vote(owner, poll, Ecto.UUID.generate())
      assert {:error, :not_found} = Polls.toggle_vote(owner, poll, "nope")

      {:ok, closed} = Polls.set_closed(owner, poll, true)
      assert {:error, :closed} = Polls.toggle_vote(owner, closed, option_id(poll, "Sábado"))
    end

    test "rejects votes on expired polls", %{owner: owner, channel: channel} do
      past = DateTime.utc_now() |> DateTime.add(-3600, :second) |> DateTime.to_iso8601()

      {:ok, poll} =
        Polls.create_poll(owner, poll_attrs(channel.id, %{"expires_at" => past}))

      assert {:error, :closed} = Polls.toggle_vote(owner, poll, option_id(poll, "Sábado"))
    end

    test "rejects members of other places", %{owner: owner, channel: channel} do
      outsider = insert_user()
      {:ok, poll} = Polls.create_poll(owner, poll_attrs(channel.id))

      assert {:error, :forbidden} =
               Polls.toggle_vote(outsider, poll, option_id(poll, "Sábado"))
    end
  end

  describe "suggest_option/3" do
    test "adds the option, auto-votes and blocks duplicates" do
      owner = insert_user()
      {_server, channel} = setup_channel(owner)
      {:ok, poll} = Polls.create_poll(owner, poll_attrs(channel.id))

      assert {:ok, poll} = Polls.suggest_option(owner, poll, "Sexta à noite")
      assert vote_ids(poll, "Sexta à noite") == [owner.id]

      assert {:error, :duplicate} = Polls.suggest_option(owner, poll, "sexta à NOITE")
    end

    test "is blocked when suggestions are disabled" do
      owner = insert_user()
      {_server, channel} = setup_channel(owner)

      {:ok, poll} =
        Polls.create_poll(owner, poll_attrs(channel.id, %{"allow_suggestions" => false}))

      assert {:error, :suggestions_disabled} = Polls.suggest_option(owner, poll, "Outra")
    end
  end

  describe "add_comment/3, set_closed/3 and delete_poll/2" do
    test "comments are stored and can be disabled" do
      owner = insert_user()
      {_server, channel} = setup_channel(owner)
      {:ok, poll} = Polls.create_poll(owner, poll_attrs(channel.id))

      assert {:ok, poll} = Polls.add_comment(owner, poll, "  Bora!  ")
      assert [%{text: "Bora!"}] = poll.comments
      assert {:error, %Ecto.Changeset{}} = Polls.add_comment(owner, poll, "   ")

      {:ok, no_comments} =
        Polls.create_poll(owner, poll_attrs(channel.id, %{"allow_comments" => false}))

      assert {:error, :comments_disabled} = Polls.add_comment(owner, no_comments, "oi")
    end

    test "only the author can close, reopen and delete" do
      owner = insert_user()
      other = insert_user()
      {server, channel} = setup_channel(owner)
      {:ok, _} = join(server, other)
      {:ok, poll} = Polls.create_poll(owner, poll_attrs(channel.id))

      assert {:error, :forbidden} = Polls.set_closed(other, poll, true)
      assert {:error, :forbidden} = Polls.delete_poll(other, poll)

      assert {:ok, closed} = Polls.set_closed(owner, poll, true)
      assert closed.closed
      assert {:ok, reopened} = Polls.set_closed(owner, closed, false)
      refute reopened.closed

      assert {:ok, _} = Polls.delete_poll(owner, poll)
      assert {:error, :not_found} = Polls.get_poll_for_user(owner, poll.id)
    end
  end

  describe "serialize/1" do
    test "exposes votes as user id lists per option" do
      owner = insert_user()
      {_server, channel} = setup_channel(owner)
      {:ok, poll} = Polls.create_poll(owner, poll_attrs(channel.id))
      {:ok, poll} = Polls.toggle_vote(owner, poll, option_id(poll, "Sábado"))

      serialized = Polls.serialize(poll)
      saturday = Enum.find(serialized.options, &(&1.text == "Sábado"))

      assert saturday.votes == [owner.id]
      assert serialized.authorName == owner.display_name
      assert serialized.closed == false
    end
  end

  defp join(server, user) do
    role = Repo.get_by!(Guilda.Servers.Role, server_id: server.id, name: "Member")

    %Guilda.Servers.ServerMember{}
    |> Guilda.Servers.ServerMember.changeset(%{
      server_id: server.id,
      user_id: user.id,
      role_id: role.id,
      joined_at: DateTime.utc_now() |> DateTime.truncate(:second)
    })
    |> Repo.insert()
  end
end
