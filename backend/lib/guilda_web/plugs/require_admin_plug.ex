defmodule GuildaWeb.RequireAdminPlug do
  @moduledoc """
  Halts the connection with 403 if the current user is not an admin.

  Must be used after `AuthPlug` and `RequireAuthPlug` in the pipeline.
  """

  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  @behaviour Plug

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, _opts) do
    case conn.assigns[:current_user] do
      %{role: "admin"} ->
        conn

      _ ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "forbidden"})
        |> halt()
    end
  end
end
