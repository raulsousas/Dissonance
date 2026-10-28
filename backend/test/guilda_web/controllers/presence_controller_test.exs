defmodule GuildaWeb.PresenceControllerTest do
  use GuildaWeb.ConnCase, async: true

  alias Guilda.Accounts
  alias Guilda.Accounts.User

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

  describe "presence controller" do
    test "GET /api/presence returns online users map", %{conn: conn} do
      user = insert_user()

      conn =
        conn
        |> authenticated_conn(user)
        |> get(~p"/api/presence")

      assert json = json_response(conn, 200)
      assert is_map(json["data"])
    end

    test "GET /api/users/:id/presence returns user presence info", %{conn: conn} do
      user = insert_user()
      other = insert_user()

      conn =
        conn
        |> authenticated_conn(user)
        |> get(~p"/api/users/#{other.id}/presence")

      assert json = json_response(conn, 200)
      assert json["data"]["userId"] == other.id
      assert json["data"]["online"] == false
      assert json["data"]["status"] == "offline"
    end
  end
end
