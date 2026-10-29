defmodule GuildaWeb.WelcomeMessageTest do
  @moduledoc "Automatic welcome message when someone joins a server through an invite."

  use GuildaWeb.ConnCase, async: true

  import Ecto.Query

  alias Guilda.Accounts
  alias Guilda.Accounts.User
  alias Guilda.{Channels, FocusMode, Messaging, Servers}

  defp insert_user(name) do
    n = System.unique_integer([:positive])

    %User{}
    |> User.changeset(%{
      email: "welcome_#{n}@example.com",
      google_sub: "welcome_sub_#{n}",
      display_name: name
    })
    |> Repo.insert!()
  end

  defp as(conn, user) do
    {:ok, {token, _session}} = Accounts.create_session(user)
    init_test_session(conn, %{token: token})
  end

  defp setup_server do
    owner = insert_user("Dona")
    {:ok, server} = Servers.create_server(owner, %{name: "Casa Azul"})
    {:ok, invite} = Servers.create_invite(server, owner)
    channel = server |> Channels.list_channels() |> hd()
    %{owner: owner, server: server, invite: invite, channel: channel}
  end

  test "joining posts a welcome message in the first text channel and broadcasts it", %{conn: conn} do
    %{invite: invite, channel: channel} = setup_server()
    newbie = insert_user("Novato")
    GuildaWeb.Endpoint.subscribe("channel:#{channel.id}")

    conn |> as(newbie) |> post(~p"/api/servers/join", %{code: invite.code}) |> json_response(200)

    assert [msg] = Messaging.list_messages(channel.id)
    assert msg.kind == "welcome"
    assert msg.author_id == newbie.id
    assert msg.content =~ "Casa Azul"
    assert msg.content =~ "@Novato"

    assert_receive %Phoenix.Socket.Broadcast{
      event: "new_message",
      payload: %{kind: "welcome", id: id, authorName: "Novato"}
    }

    assert id == msg.id
  end

  test "history returns the message flagged as welcome, once per join", %{conn: conn} do
    %{owner: owner, invite: invite, channel: channel} = setup_server()
    newbie = insert_user("Novato")
    conn |> as(newbie) |> post(~p"/api/servers/join", %{code: invite.code}) |> json_response(200)

    # Already a member: rejected, and no second welcome.
    assert conn |> as(newbie) |> post(~p"/api/servers/join", %{code: invite.code}) |> json_response(409)

    %{"messages" => [m]} =
      conn |> as(owner) |> get(~p"/api/channels/#{channel.id}/messages") |> json_response(200)

    assert m["kind"] == "welcome"
  end

  test "an invalid or exhausted invite posts nothing", %{conn: conn} do
    %{channel: channel} = setup_server()
    newbie = insert_user("Novato")

    assert conn |> as(newbie) |> post(~p"/api/servers/join", %{code: "nope"}) |> json_response(404)
    assert Messaging.list_messages(channel.id) == []
  end

  test "a server without text channels still lets the user join", %{conn: conn} do
    %{server: server, invite: invite} = setup_server()
    Enum.each(Channels.list_channels(server), &Channels.delete_channel/1)
    newbie = insert_user("Novato")

    assert conn |> as(newbie) |> post(~p"/api/servers/join", %{code: invite.code}) |> json_response(200)
    assert Servers.member?(server, newbie)
  end

  test "clients cannot forge a welcome message", %{conn: conn} do
    %{server: server, channel: channel} = setup_server()
    member = insert_user("Membro")
    {:ok, _} = Servers.add_member(server, member)

    resp =
      conn
      |> as(member)
      |> post(~p"/api/channels/#{channel.id}/messages", %{content: "oi", kind: "welcome"})
      |> json_response(201)

    assert resp["message"]["kind"] == "user"
  end

  test "welcome messages are excluded from search and focus summaries", %{conn: conn} do
    %{owner: owner, server: server, invite: invite, channel: channel} = setup_server()
    {:ok, _} = FocusMode.mute(owner, channel.id)
    past = DateTime.utc_now() |> DateTime.add(-3600, :second) |> DateTime.truncate(:second)

    Repo.update_all(
      from(m in Guilda.FocusMode.ChannelMute, where: m.user_id == ^owner.id),
      set: [muted_at: past]
    )

    newbie = insert_user("Novato")
    conn |> as(newbie) |> post(~p"/api/servers/join", %{code: invite.code}) |> json_response(200)

    assert {:ok, %{total: 0}} = FocusMode.summary(owner, channel.id)
    assert %{results: []} = Messaging.search_messages(server.id, text: "Bem-vindo")
  end
end
