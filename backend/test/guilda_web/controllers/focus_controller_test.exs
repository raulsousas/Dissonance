defmodule GuildaWeb.FocusControllerTest do
  @moduledoc "HTTP-level checks for focus mode: auth, isolation, notification suppression and nudges."

  use GuildaWeb.ConnCase, async: true

  alias Guilda.Accounts
  alias Guilda.Accounts.User
  alias Guilda.{Channels, FocusMode, Friendships, Servers}

  defp insert_user(name) do
    n = System.unique_integer([:positive])

    %User{}
    |> User.changeset(%{
      email: "focushttp_#{n}@example.com",
      google_sub: "focushttp_sub_#{n}",
      display_name: name
    })
    |> Repo.insert!()
  end

  defp as(conn, user) do
    {:ok, {token, _session}} = Accounts.create_session(user)
    init_test_session(conn, %{token: token})
  end

  defp setup_channel(owner) do
    {:ok, server} = Servers.create_server(owner, %{name: "Focus HTTP"})
    {server, hd(Channels.list_channels(server))}
  end

  test "all endpoints reject anonymous users", %{conn: conn} do
    id = Ecto.UUID.generate()

    for {method, path} <- [
          {:get, "/api/focus/muted"},
          {:put, "/api/channels/#{id}/mute"},
          {:delete, "/api/channels/#{id}/mute"},
          {:get, "/api/channels/#{id}/focus-summary"}
        ] do
      conn = Phoenix.ConnTest.dispatch(conn, @endpoint, method, path, %{})
      assert conn.status in [401, 403], "#{method} #{path} returned #{conn.status}"
    end
  end

  test "mute, list, summary and unmute over HTTP", %{conn: conn} do
    owner = insert_user("Dona")
    member = insert_user("Membro")
    {server, channel} = setup_channel(owner)
    {:ok, _} = Servers.add_member(server, member)

    assert %{"muted" => []} = conn |> as(member) |> get(~p"/api/focus/muted") |> json_response(200)

    assert %{"channelId" => _, "mutedAt" => _} =
             conn |> as(member) |> put(~p"/api/channels/#{channel.id}/mute") |> json_response(200)

    assert %{"muted" => [%{"channelId" => id}]} =
             conn |> as(member) |> get(~p"/api/focus/muted") |> json_response(200)

    assert id == channel.id

    assert %{"summary" => %{"total" => 0, "authors" => [], "links" => [], "mentions" => []}} =
             conn |> as(member) |> get(~p"/api/channels/#{channel.id}/focus-summary") |> json_response(200)

    assert conn |> as(member) |> delete(~p"/api/channels/#{channel.id}/mute") |> response(204)
    assert %{"muted" => []} = conn |> as(member) |> get(~p"/api/focus/muted") |> json_response(200)

    assert conn |> as(member) |> get(~p"/api/channels/#{channel.id}/focus-summary") |> json_response(404)
  end

  test "a non-member gets 404 for mute and summary", %{conn: conn} do
    owner = insert_user("Dona")
    outsider = insert_user("Fora")
    {_server, channel} = setup_channel(owner)

    assert conn |> as(outsider) |> put(~p"/api/channels/#{channel.id}/mute") |> json_response(404)
    assert conn |> as(outsider) |> get(~p"/api/channels/#{channel.id}/focus-summary") |> json_response(404)
    assert conn |> as(outsider) |> put(~p"/api/channels/not-a-uuid/mute") |> json_response(404)
    assert FocusMode.list_muted(outsider) == []
  end

  test "muting is per user: another member's mutes are not visible", %{conn: conn} do
    owner = insert_user("Dona")
    member = insert_user("Membro")
    {server, channel} = setup_channel(owner)
    {:ok, _} = Servers.add_member(server, member)

    conn |> as(member) |> put(~p"/api/channels/#{channel.id}/mute") |> json_response(200)

    assert %{"muted" => []} = conn |> as(owner) |> get(~p"/api/focus/muted") |> json_response(200)
    assert conn |> as(owner) |> get(~p"/api/channels/#{channel.id}/focus-summary") |> json_response(404)
  end

  describe "notifications" do
    test "a silenced channel does not notify the user; others still are", %{conn: conn} do
      author = insert_user("Autor")
      focused = insert_user("Focado")
      normal = insert_user("Normal")
      {server, channel} = setup_channel(author)
      {:ok, _} = Servers.add_member(server, focused)
      {:ok, _} = Servers.add_member(server, normal)
      {:ok, _} = FocusMode.mute(focused, channel.id)

      GuildaWeb.Endpoint.subscribe("user:#{focused.id}")
      GuildaWeb.Endpoint.subscribe("user:#{normal.id}")

      conn
      |> as(author)
      |> post(~p"/api/channels/#{channel.id}/messages", %{content: "olá pessoal"})
      |> json_response(201)

      normal_id = normal.id
      focused_id = focused.id
      assert_receive %Phoenix.Socket.Broadcast{topic: "user:" <> ^normal_id, event: "new_server_message"}
      refute_receive %Phoenix.Socket.Broadcast{topic: "user:" <> ^focused_id, event: "new_server_message"}, 100
    end

    test "a friend's nudge still reaches a user who silenced every channel", %{conn: conn} do
      owner = insert_user("Dono")
      friend = insert_user("Amigo")
      {_server, channel} = setup_channel(owner)

      {:ok, friendship} = Friendships.send_request(friend, owner.id)
      {:ok, _} = Friendships.accept_request(owner, friendship.id)
      {:ok, _} = FocusMode.mute(owner, channel.id)

      GuildaWeb.Endpoint.subscribe("user:#{owner.id}")

      # The cooldown key is per (sender, target) UUID pair, so it is always fresh here.
      assert conn |> as(friend) |> post(~p"/api/friends/#{owner.id}/nudge") |> response(204)
      assert_receive %Phoenix.Socket.Broadcast{event: "nudge_received", payload: %{fromName: "Amigo"}}
    end
  end
end
