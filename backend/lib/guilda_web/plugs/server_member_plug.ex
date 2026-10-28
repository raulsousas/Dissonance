defmodule GuildaWeb.ServerMemberPlug do
  @moduledoc """
  Loads the server from the `:server_id` path param and verifies the
  current user is a member. Sets `conn.assigns.server` and
  `conn.assigns.membership`.

  Must be used after `AuthPlug` + `RequireAuthPlug`.
  """

  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  alias Guilda.Servers

  @behaviour Plug

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(%{params: %{"server_id" => server_id}} = conn, _opts) do
    user = conn.assigns.current_user

    case Servers.get_server(server_id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "server not found"}) |> halt()

      server ->
        case Servers.get_membership(server, user) do
          nil ->
            conn |> put_status(:forbidden) |> json(%{error: "not a member"}) |> halt()

          membership ->
            conn
            |> assign(:server, server)
            |> assign(:membership, membership)
        end
    end
  end

  def call(conn, _opts), do: conn
end
