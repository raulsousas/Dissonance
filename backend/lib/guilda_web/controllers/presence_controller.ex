defmodule GuildaWeb.PresenceController do
  @moduledoc """
  Controller for querying online presence.
  """

  use GuildaWeb, :controller
  alias GuildaWeb.Presence

  # GET /api/presence
  def index(conn, _params) do
    users = Presence.list_online_users()
    json(conn, %{data: users})
  end

  # GET /api/users/:id/presence
  def show(conn, %{"id" => user_id}) do
    info = Presence.get_user_presence(user_id)
    json(conn, %{data: info})
  end
end
