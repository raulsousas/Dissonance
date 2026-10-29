defmodule GuildaWeb.FeaturesControllerTest do
  @moduledoc "HTTP-level checks for polls, reminders and search (auth, status codes, isolation)."

  use GuildaWeb.ConnCase, async: true

  import Ecto.Query, only: [from: 2]

  alias Guilda.Accounts
  alias Guilda.Accounts.User
  alias Guilda.{Channels, Messaging, Servers}

  defp insert_user(name) do
    n = System.unique_integer([:positive])

    %User{}
    |> User.changeset(%{
      email: "feat_#{n}@example.com",
      google_sub: "feat_sub_#{n}",
      display_name: name
    })
    |> Repo.insert!()
  end

  defp as(conn, user) do
    {:ok, {token, _session}} = Accounts.create_session(user)
    init_test_session(conn, %{token: token})
  end

  defp setup_channel(owner) do
    {:ok, server} = Servers.create_server(owner, %{name: "HTTP Server"})
    {server, hd(Channels.list_channels(server))}
  end

  defp iso_in(seconds),
    do: DateTime.utc_now() |> DateTime.add(seconds, :second) |> DateTime.to_iso8601()

  describe "authentication" do
    test "all new endpoints reject anonymous users", %{conn: conn} do
      id = Ecto.UUID.generate()

      for {method, path} <- [
            {:post, "/api/polls"},
            {:get, "/api/polls/#{id}"},
            {:post, "/api/polls/#{id}/votes"},
            {:get, "/api/reminders"},
            {:post, "/api/reminders"},
            {:delete, "/api/reminders/#{id}"},
            {:get, "/api/servers/#{id}/search?q=x"}
          ] do
        conn = conn |> Phoenix.ConnTest.dispatch(@endpoint, method, path, %{})
        assert conn.status in [401, 403], "#{method} #{path} returned #{conn.status}"
      end
    end
  end

  describe "polls" do
    test "create, vote, close and delete over HTTP; broadcasts to the channel", %{conn: conn} do
      owner = insert_user("Owner")
      {_server, channel} = setup_channel(owner)
      GuildaWeb.Endpoint.subscribe("channel:#{channel.id}")

      created =
        conn
        |> as(owner)
        |> post(~p"/api/polls", %{
          scope: "channel",
          channel_id: channel.id,
          title: "Raid?",
          options: ["Sábado", "Domingo"]
        })
        |> json_response(201)

      poll = created["poll"]
      assert poll["title"] == "Raid?"
      assert_receive %Phoenix.Socket.Broadcast{event: "poll_updated", payload: %{title: "Raid?"}}

      option_id = hd(poll["options"])["id"]

      voted =
        conn |> as(owner) |> post(~p"/api/polls/#{poll["id"]}/votes", %{option_id: option_id}) |> json_response(200)

      assert hd(voted["poll"]["options"])["votes"] == [owner.id]

      closed = conn |> as(owner) |> patch(~p"/api/polls/#{poll["id"]}", %{closed: true}) |> json_response(200)
      assert closed["poll"]["closed"] == true

      reopened = conn |> as(owner) |> patch(~p"/api/polls/#{poll["id"]}", %{closed: false}) |> json_response(200)
      assert reopened["poll"]["closed"] == false

      assert conn |> as(owner) |> patch(~p"/api/polls/#{poll["id"]}", %{}) |> json_response(422)

      assert conn |> as(owner) |> delete(~p"/api/polls/#{poll["id"]}") |> response(204)
      assert_receive %Phoenix.Socket.Broadcast{event: "poll_deleted"}
      assert conn |> as(owner) |> get(~p"/api/polls/#{poll["id"]}") |> json_response(404)
    end

    test "non-members get 403 and cannot create polls in someone else's channel", %{conn: conn} do
      owner = insert_user("Owner")
      outsider = insert_user("Outsider")
      {_server, channel} = setup_channel(owner)

      body = %{scope: "channel", channel_id: channel.id, title: "x", options: ["a", "b"]}
      assert conn |> as(outsider) |> post(~p"/api/polls", body) |> json_response(403)

      {:ok, poll} = Guilda.Polls.create_poll(owner, Map.new(body, fn {k, v} -> {to_string(k), v} end))
      assert conn |> as(outsider) |> get(~p"/api/polls/#{poll.id}") |> json_response(403)
    end

    test "only the author can close or delete", %{conn: conn} do
      owner = insert_user("Owner")
      other = insert_user("Other")
      {server, channel} = setup_channel(owner)
      role = Repo.get_by!(Guilda.Servers.Role, server_id: server.id, name: "Member")

      Repo.insert!(%Guilda.Servers.ServerMember{
        server_id: server.id,
        user_id: other.id,
        role_id: role.id,
        joined_at: DateTime.utc_now() |> DateTime.truncate(:second)
      })

      {:ok, poll} =
        Guilda.Polls.create_poll(owner, %{
          "scope" => "channel",
          "channel_id" => channel.id,
          "title" => "x",
          "options" => ["a", "b"]
        })

      assert conn |> as(other) |> patch(~p"/api/polls/#{poll.id}", %{closed: true}) |> json_response(403)
      assert conn |> as(other) |> delete(~p"/api/polls/#{poll.id}") |> json_response(403)
    end

    test "invalid ids return 404 instead of crashing", %{conn: conn} do
      user = insert_user("User")
      assert conn |> as(user) |> get(~p"/api/polls/not-a-uuid") |> json_response(404)
    end
  end
  describe "polls channel" do
    defp polls_channel(server) do
      {:ok, ch} = Channels.create_channel(server, %{name: "enquetes", type: "polls"})
      ch
    end

    defp create_poll!(user, channel, title) do
      {:ok, poll} =
        Guilda.Polls.create_poll(user, %{
          "scope" => "channel",
          "channel_id" => channel.id,
          "title" => title,
          "options" => ["a", "b"]
        })

      poll
    end

    test "GET /api/channels/:id/polls lists only that channel's polls, newest first", %{conn: conn} do
      owner = insert_user("Owner")
      {server, text_channel} = setup_channel(owner)
      channel = polls_channel(server)

      first = create_poll!(owner, channel, "Primeira")
      second = create_poll!(owner, channel, "Segunda")
      create_poll!(owner, text_channel, "Outro canal")

      Repo.update_all(
        from(p in Guilda.Polls.Poll, where: p.id == ^first.id),
        set: [inserted_at: DateTime.utc_now() |> DateTime.add(-60, :second) |> DateTime.truncate(:second)]
      )

      body = conn |> as(owner) |> get(~p"/api/channels/#{channel.id}/polls") |> json_response(200)
      assert Enum.map(body["polls"], & &1["title"]) == ["Segunda", "Primeira"]
      assert hd(body["polls"])["id"] == second.id
    end

    test "rejects anonymous users, non-members and invalid ids", %{conn: conn} do
      owner = insert_user("Owner")
      outsider = insert_user("Outsider")
      {server, _} = setup_channel(owner)
      channel = polls_channel(server)

      assert conn |> get(~p"/api/channels/#{channel.id}/polls") |> json_response(401)
      assert conn |> as(outsider) |> get(~p"/api/channels/#{channel.id}/polls") |> json_response(404)
      assert conn |> as(owner) |> get(~p"/api/channels/not-a-uuid/polls") |> json_response(404)
    end

    test "chat messages cannot be posted to a polls channel", %{conn: conn} do
      owner = insert_user("Owner")
      {server, _} = setup_channel(owner)
      channel = polls_channel(server)

      assert conn
             |> as(owner)
             |> post(~p"/api/channels/#{channel.id}/messages", %{content: "oi"})
             |> json_response(422)

      assert Messaging.list_messages(channel.id) == []
    end

    test "owner can create a polls channel over HTTP; unknown types are rejected", %{conn: conn} do
      owner = insert_user("Owner")
      {server, _} = setup_channel(owner)

      created =
        conn
        |> as(owner)
        |> post(~p"/api/servers/#{server.id}/channels", %{name: "enquetes", type: "polls"})
        |> json_response(201)

      assert created["data"]["type"] == "polls"

      assert conn
             |> as(owner)
             |> post(~p"/api/servers/#{server.id}/channels", %{name: "x", type: "bogus"})
             |> json_response(422)
    end
  end



  describe "reminders" do
    test "create, list and delete", %{conn: conn} do
      owner = insert_user("Owner")
      {_server, channel} = setup_channel(owner)

      {:ok, message} =
        Messaging.create_message(%{content: "lembrar disso", channel_id: channel.id, author_id: owner.id})

      created =
        conn
        |> as(owner)
        |> post(~p"/api/reminders", %{scope: "channel", message_id: message.id, remind_at: iso_in(3600)})
        |> json_response(201)

      assert created["reminder"]["preview"] == "lembrar disso"
      assert created["reminder"]["due"] == false

      listed = conn |> as(owner) |> get(~p"/api/reminders") |> json_response(200)
      assert [%{"id" => id}] = listed["reminders"]

      assert conn |> as(owner) |> delete(~p"/api/reminders/#{id}") |> response(204)
      assert (conn |> as(owner) |> get(~p"/api/reminders") |> json_response(200))["reminders"] == []
    end

    test "maps errors to status codes", %{conn: conn} do
      owner = insert_user("Owner")
      outsider = insert_user("Outsider")
      {_server, channel} = setup_channel(owner)

      {:ok, message} =
        Messaging.create_message(%{content: "x", channel_id: channel.id, author_id: owner.id})

      ok_body = %{scope: "channel", message_id: message.id, remind_at: iso_in(3600)}

      assert conn |> as(owner) |> post(~p"/api/reminders", %{ok_body | remind_at: "ontem"}) |> json_response(422)
      assert conn |> as(outsider) |> post(~p"/api/reminders", ok_body) |> json_response(403)

      assert conn
             |> as(owner)
             |> post(~p"/api/reminders", %{ok_body | message_id: Ecto.UUID.generate()})
             |> json_response(404)
    end

    test "users cannot delete or see each other's reminders", %{conn: conn} do
      owner = insert_user("Owner")
      other = insert_user("Other")
      {_server, channel} = setup_channel(owner)

      {:ok, message} =
        Messaging.create_message(%{content: "x", channel_id: channel.id, author_id: owner.id})

      {:ok, reminder} =
        Guilda.Reminders.create_reminder(owner, %{
          "scope" => "channel",
          "message_id" => message.id,
          "remind_at" => iso_in(3600)
        })

      assert conn |> as(other) |> delete(~p"/api/reminders/#{reminder.id}") |> json_response(404)
      assert (conn |> as(other) |> get(~p"/api/reminders") |> json_response(200))["reminders"] == []
    end
  end

  describe "search" do
    test "members find messages with filters; results carry channel info", %{conn: conn} do
      owner = insert_user("Ana")
      {server, channel} = setup_channel(owner)

      {:ok, _} =
        Messaging.create_message(%{content: "veja https://example.com", channel_id: channel.id, author_id: owner.id})

      {:ok, _} = Messaging.create_message(%{content: "sem link", channel_id: channel.id, author_id: owner.id})

      body =
        conn
        |> as(owner)
        |> get(~p"/api/servers/#{server.id}/search", %{has: "link", from: "ana"})
        |> json_response(200)

      assert [%{"content" => "veja https://example.com", "channelName" => "general"}] = body["results"]
      assert body["has_more"] == false
    end

    test "non-members and unknown servers both get 404", %{conn: conn} do
      owner = insert_user("Ana")
      outsider = insert_user("Eve")
      {server, _channel} = setup_channel(owner)

      assert conn |> as(outsider) |> get(~p"/api/servers/#{server.id}/search", %{q: "x"}) |> json_response(404)
      assert conn |> as(owner) |> get(~p"/api/servers/#{Ecto.UUID.generate()}/search", %{q: "x"}) |> json_response(404)
      assert conn |> as(owner) |> get(~p"/api/servers/not-a-uuid/search", %{q: "x"}) |> json_response(404)
    end

    test "ignores unsupported has values and bad limits", %{conn: conn} do
      owner = insert_user("Ana")
      {server, channel} = setup_channel(owner)
      {:ok, _} = Messaging.create_message(%{content: "olá", channel_id: channel.id, author_id: owner.id})

      body =
        conn
        |> as(owner)
        |> get(~p"/api/servers/#{server.id}/search", %{q: "olá", has: "DROP", limit: "abc"})
        |> json_response(200)

      assert length(body["results"]) == 1
    end
  end
end
