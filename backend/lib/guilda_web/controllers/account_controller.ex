defmodule GuildaWeb.AccountController do
  @moduledoc """
  API endpoints for the current user's account.
  """

  use GuildaWeb, :controller

  # GET /api/me — returns the current authenticated user
  def me(conn, _params) do
    user = conn.assigns.current_user

    json(conn, %{
      data: %{
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        status: user.status,
        role: user.role
      }
    })
  end
end
