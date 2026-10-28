defmodule GuildaWeb.AccountController do
  @moduledoc """
  API endpoints for the current user's account.
  """

  use GuildaWeb, :controller
  alias Guilda.Accounts

  # GET /api/me — returns the current authenticated user
  def me(conn, _params) do
    user = conn.assigns.current_user
    token = get_session(conn, :token)

    json(conn, %{
      data: %{
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        status: user.status,
        role: user.role,
        token: token
      }
    })
  end

  # PATCH /api/me — updates the current authenticated user's profile
  def update(conn, params) do
    user = conn.assigns.current_user
    token = get_session(conn, :token)

    attrs = %{}
    attrs = if Map.has_key?(params, "displayName"), do: Map.put(attrs, :display_name, params["displayName"]), else: attrs
    attrs = if Map.has_key?(params, "display_name"), do: Map.put(attrs, :display_name, params["display_name"]), else: attrs
    attrs = if Map.has_key?(params, "avatarUrl"), do: Map.put(attrs, :avatar_url, params["avatarUrl"]), else: attrs
    attrs = if Map.has_key?(params, "avatar_url"), do: Map.put(attrs, :avatar_url, params["avatar_url"]), else: attrs
    attrs = if Map.has_key?(params, "status"), do: Map.put(attrs, :status, params["status"]), else: attrs

    case Accounts.update_user(user, attrs) do
      {:ok, updated} ->
        json(conn, %{
          data: %{
            id: updated.id,
            email: updated.email,
            displayName: updated.display_name,
            avatarUrl: updated.avatar_url,
            status: updated.status,
            role: updated.role,
            token: token
          }
        })

      {:error, _changeset} ->
        conn |> put_status(422) |> json(%{error: "Validation failed"})
    end
  end
end
