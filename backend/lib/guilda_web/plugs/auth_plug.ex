defmodule GuildaWeb.AuthPlug do
  @moduledoc """
  Reads the session cookie and loads the current user into `conn.assigns.current_user`.

  Place this plug in any pipeline that needs to know the current user.
  It does NOT halt unauthenticated requests — use `RequireAuthPlug` for that.
  """

  import Plug.Conn
  alias Guilda.Accounts

  @behaviour Plug

  @impl Plug
  def init(opts), do: opts

  @impl Plug
  def call(conn, _opts) do
    with token when is_binary(token) <- get_session(conn, :token),
         {:ok, user} <- Accounts.get_user_by_session_token(token) do
      assign(conn, :current_user, user)
    else
      _ -> assign(conn, :current_user, nil)
    end
  end
end
