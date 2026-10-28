defmodule GuildaWeb.HealthController do
  use GuildaWeb, :controller

  @doc """
  Health check endpoint used by Docker Compose and load balancers.
  Returns 200 OK with application status.
  """
  def index(conn, _params) do
    json(conn, %{status: "ok", app: "guilda"})
  end
end
