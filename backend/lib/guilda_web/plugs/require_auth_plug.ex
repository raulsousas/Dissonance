defmodule GuildaWeb.RequireAuthPlug do
  @moduledoc """
  Halts the connection with 401 if no authenticated user is found in assigns.

  Must be used after `AuthPlug` in the pipeline.
  """

  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  @behaviour Plug

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, _opts) do
    case conn.assigns[:current_user] do
      nil ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "unauthenticated"})
        |> halt()

      _user ->
        conn
    end
  end
end
