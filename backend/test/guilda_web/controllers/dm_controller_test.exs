defmodule GuildaWeb.DmControllerTest do
  use GuildaWeb.ConnCase, async: true

  alias Guilda.Accounts
  alias Guilda.Accounts.User
  alias Guilda.DirectMessaging

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

  describe "DM endpoints" do
    test "POST /api/dm opens conversation and GET /api/dm lists it", %{conn: conn} do
      u1 = insert_user()
      u2 = insert_user(%{display_name: "Bob"})

      conn1 =
        conn
        |> authenticated_conn(u1)
        |> post(~p"/api/dm", %{userId: u2.id})

      assert json = json_response(conn1, 201)
      conv_id = json["data"]["id"]
      assert json["data"]["recipient"]["displayName"] == "Bob"

      conn2 =
        conn
        |> authenticated_conn(u1)
        |> get(~p"/api/dm")

      assert list_json = json_response(conn2, 200)
      assert length(list_json["data"]) == 1
      assert hd(list_json["data"])["id"] == conv_id
    end

    test "GET /api/dm/:id/messages and POST /api/dm/:id/messages", %{conn: conn} do
      u1 = insert_user()
      u2 = insert_user()

      {:ok, conv} = DirectMessaging.get_or_create_conversation(u1.id, u2.id)

      conn1 =
        conn
        |> authenticated_conn(u1)
        |> post(~p"/api/dm/#{conv.id}/messages", %{content: "Hello from test"})

      assert json = json_response(conn1, 201)
      assert json["data"]["content"] == "Hello from test"

      conn2 =
        conn
        |> authenticated_conn(u2)
        |> get(~p"/api/dm/#{conv.id}/messages")

      assert list_json = json_response(conn2, 200)
      assert length(list_json["messages"]) == 1
    end

    test "stranger cannot read DM messages", %{conn: conn} do
      u1 = insert_user()
      u2 = insert_user()
      stranger = insert_user()

      {:ok, conv} = DirectMessaging.get_or_create_conversation(u1.id, u2.id)

      conn =
        conn
        |> authenticated_conn(stranger)
        |> get(~p"/api/dm/#{conv.id}/messages")

      assert json_response(conn, 403)
    end
  end
end
