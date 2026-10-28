defmodule GuildaWeb.AuthControllerTest do
  use GuildaWeb.ConnCase, async: true

  alias Guilda.Accounts
  alias Guilda.Accounts.User

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp insert_user(overrides \\ %{}) do
    attrs =
      %{
        email: "user_#{System.unique_integer([:positive])}@example.com",
        google_sub: "sub_#{System.unique_integer([:positive])}",
        display_name: "Test User"
      }
      |> Map.merge(overrides)

    %User{}
    |> User.changeset(attrs)
    |> Guilda.Repo.insert!()
  end

  # ---------------------------------------------------------------------------
  # GET /api/me
  # ---------------------------------------------------------------------------

  describe "GET /api/me" do
    test "returns 401 when not authenticated", %{conn: conn} do
      conn = get(conn, ~p"/api/me")
      assert json_response(conn, 401)["error"] == "unauthenticated"
    end

    test "returns current user when authenticated", %{conn: conn} do
      user = insert_user()
      {:ok, {token, _}} = Accounts.create_session(user)

      conn =
        conn
        |> init_test_session(%{token: token})
        |> get(~p"/api/me")

      body = json_response(conn, 200)
      assert body["data"]["id"] == user.id
      assert body["data"]["email"] == user.email
      assert body["data"]["role"] == user.role
    end
  end

  # ---------------------------------------------------------------------------
  # DELETE /auth/logout
  # ---------------------------------------------------------------------------

  describe "DELETE /auth/logout" do
    test "clears the session and returns 204", %{conn: conn} do
      user = insert_user()
      {:ok, {token, _}} = Accounts.create_session(user)

      conn =
        conn
        |> init_test_session(%{token: token})
        |> delete(~p"/auth/logout")

      assert response(conn, 204)

      # The token should now be invalid
      assert {:error, :invalid} = Accounts.get_user_by_session_token(token)
    end

    test "returns 204 even when not logged in", %{conn: conn} do
      conn = delete(conn, ~p"/auth/logout")
      assert response(conn, 204)
    end
  end

  # ---------------------------------------------------------------------------
  # Admin endpoints
  # ---------------------------------------------------------------------------

  describe "GET /api/admin/users" do
    test "returns 401 when unauthenticated", %{conn: conn} do
      conn = get(conn, ~p"/api/admin/users")
      assert json_response(conn, 401)
    end

    test "returns 403 when not admin", %{conn: conn} do
      user = insert_user()
      {:ok, {token, _}} = Accounts.create_session(user)

      conn =
        conn
        |> init_test_session(%{token: token})
        |> get(~p"/api/admin/users")

      assert json_response(conn, 403)["error"] == "forbidden"
    end

    test "returns user list for admin", %{conn: conn} do
      admin = insert_user(%{role: "admin"})
      {:ok, {token, _}} = Accounts.create_session(admin)

      conn =
        conn
        |> init_test_session(%{token: token})
        |> get(~p"/api/admin/users")

      body = json_response(conn, 200)
      assert is_list(body["data"])
      assert Enum.any?(body["data"], fn u -> u["id"] == admin.id end)
    end
  end

  describe "POST /api/admin/allowed-emails" do
    test "adds email to allowlist", %{conn: conn} do
      admin = insert_user(%{role: "admin"})
      {:ok, {token, _}} = Accounts.create_session(admin)

      conn =
        conn
        |> init_test_session(%{token: token})
        |> post(~p"/api/admin/allowed-emails", %{email: "new_allowed@example.com"})

      assert json_response(conn, 201)["data"]["email"] == "new_allowed@example.com"
      assert Accounts.email_allowed?("new_allowed@example.com")
    end

    test "returns 422 for invalid email", %{conn: conn} do
      admin = insert_user(%{role: "admin"})
      {:ok, {token, _}} = Accounts.create_session(admin)

      conn =
        conn
        |> init_test_session(%{token: token})
        |> post(~p"/api/admin/allowed-emails", %{email: "not-an-email"})

      assert json_response(conn, 422)
    end
  end
end
