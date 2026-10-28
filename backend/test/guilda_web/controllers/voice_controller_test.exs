defmodule GuildaWeb.VoiceControllerTest do
  use GuildaWeb.ConnCase, async: true

  alias Guilda.Accounts
  alias Guilda.Accounts.User
  alias Guilda.Servers
  alias Guilda.Channels

  defp insert_user(overrides \\ %{}) do
    attrs =
      %{
        email: "user_#{System.unique_integer([:positive])}@example.com",
        google_sub: "sub_#{System.unique_integer([:positive])}",
        display_name: "User #{System.unique_integer([:positive])}"
      }
      |> Map.merge(overrides)

    %User{}
    |> User.changeset(attrs)
    |> Repo.insert!()
  end

  defp authenticated_conn(conn, user) do
    {:ok, {token, _session}} = Accounts.create_session(user)

    conn
    |> init_test_session(%{token: token})
  end

  describe "POST /api/channels/:channel_id/voice/token" do
    test "returns token for authorized member", %{conn: conn} do
      owner = insert_user()
      {:ok, server} = Servers.create_server(owner, %{name: "Voice Server"})
      {:ok, channel} = Channels.create_channel(server, %{name: "Lounge", type: "voice"})

      conn =
        conn
        |> authenticated_conn(owner)
        |> post(~p"/api/channels/#{channel.id}/voice/token")

      assert json = json_response(conn, 200)
      assert is_binary(json["data"]["token"])
      assert json["data"]["room"] == channel.id
    end

    test "returns 400 for text channel", %{conn: conn} do
      owner = insert_user()
      {:ok, server} = Servers.create_server(owner, %{name: "Text Server"})
      {:ok, channel} = Channels.create_channel(server, %{name: "general", type: "text"})

      conn =
        conn
        |> authenticated_conn(owner)
        |> post(~p"/api/channels/#{channel.id}/voice/token")

      assert json_response(conn, 400)
    end
  end
end
