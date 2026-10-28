defmodule GuildaWeb.AdminController do
  @moduledoc """
  Admin-only API endpoints for user and access management.
  All routes require the current user to have role == "admin".
  """

  use GuildaWeb, :controller

  alias Guilda.Accounts

  # GET /api/admin/users — list all users
  def list_users(conn, _params) do
    users = Accounts.list_users()

    json(conn, %{
      data:
        Enum.map(users, fn u ->
          %{
            id: u.id,
            email: u.email,
            displayName: u.display_name,
            avatarUrl: u.avatar_url,
            role: u.role,
            insertedAt: u.inserted_at
          }
        end)
    })
  end

  # GET /api/admin/allowed-emails — list allowed emails
  def list_allowed_emails(conn, _params) do
    emails = Accounts.list_allowed_emails()
    json(conn, %{data: emails})
  end

  # POST /api/admin/allowed-emails — add email to allowlist
  def add_allowed_email(conn, %{"email" => email}) do
    case validate_email(email) do
      :ok ->
        Accounts.allow_email(email)
        conn |> put_status(:created) |> json(%{data: %{email: String.downcase(email)}})

      :error ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "invalid email address"})
    end
  end

  def add_allowed_email(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "email is required"})
  end

  # DELETE /api/admin/allowed-emails/:email — remove email from allowlist
  def remove_allowed_email(conn, %{"email" => email}) do
    Accounts.remove_allowed_email(email)
    send_resp(conn, :no_content, "")
  end

  # POST /api/admin/users/:id/promote — promote user to admin
  def promote_user(conn, %{"id" => id}) do
    case Accounts.get_user(id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "user not found"})

      user ->
        case Accounts.promote_to_admin(user) do
          {:ok, updated} ->
            json(conn, %{data: %{id: updated.id, role: updated.role}})

          {:error, _changeset} ->
            conn |> put_status(:unprocessable_entity) |> json(%{error: "failed to promote user"})
        end
    end
  end

  # DELETE /api/admin/users/:id/access — revoke user's sessions
  def revoke_access(conn, %{"id" => id}) do
    case Accounts.get_user(id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "user not found"})

      user ->
        Accounts.revoke_access(user)
        send_resp(conn, :no_content, "")
    end
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp validate_email(email) when is_binary(email) do
    if Regex.match?(~r/^[^\s@]+@[^\s@]+\.[^\s@]+$/, String.trim(email)) do
      :ok
    else
      :error
    end
  end

  defp validate_email(_), do: :error
end
