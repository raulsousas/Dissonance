defmodule GuildaWeb.FriendsControllerTest do
  use GuildaWeb.ConnCase, async: true

  alias Guilda.Accounts
  alias Guilda.Accounts.User
  alias Guilda.Friendships

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

  describe "Friends endpoints" do
    test "GET /api/friends lists friends", %{conn: conn} do
      u1 = insert_user()
      u2 = insert_user(%{display_name: "Bob"})

      {:ok, f} = Friendships.send_request(u1, u2.id)
      {:ok, _} = Friendships.accept_request(u2, f.id)

      conn =
        conn
        |> authenticated_conn(u1)
        |> get(~p"/api/friends")

      assert json = json_response(conn, 200)
      assert length(json["data"]) == 1
      assert hd(json["data"])["displayName"] == "Bob"
    end

    test "POST /api/friends/requests sends friend request", %{conn: conn} do
      u1 = insert_user()
      _u2 = insert_user(%{email: "friend@example.com"})

      conn =
        conn
        |> authenticated_conn(u1)
        |> post(~p"/api/friends/requests", %{email: "friend@example.com"})

      assert json = json_response(conn, 201)
      assert json["data"]["status"] == "pending"
    end

    test "POST /api/friends/requests/:id/accept accepts request", %{conn: conn} do
      u1 = insert_user()
      u2 = insert_user()

      {:ok, f} = Friendships.send_request(u1, u2.id)

      conn =
        conn
        |> authenticated_conn(u2)
        |> post(~p"/api/friends/requests/#{f.id}/accept")

      assert json = json_response(conn, 200)
      assert json["data"]["status"] == "accepted"
    end

    test "DELETE /api/friends/requests/:id declines request", %{conn: conn} do
      u1 = insert_user()
      u2 = insert_user()

      {:ok, f} = Friendships.send_request(u1, u2.id)

      conn =
        conn
        |> authenticated_conn(u2)
        |> delete(~p"/api/friends/requests/#{f.id}")

      assert response(conn, 204)
    end
  end
end
