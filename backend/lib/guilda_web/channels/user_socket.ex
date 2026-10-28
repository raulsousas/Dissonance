defmodule GuildaWeb.UserSocket do
  use Phoenix.Socket

  channel "channel:*", GuildaWeb.ChannelChannel
  channel "dm:*",      GuildaWeb.DmChannel

  @impl true
  def connect(%{"token" => token}, socket, _connect_info) do
    case Guilda.Accounts.get_user_by_session_token(token) do
      {:ok, user} -> {:ok, assign(socket, :current_user, user)}
      {:error, _} -> :error
    end
  end

  # Allow connection without token — socket.assigns.current_user will be nil.
  # Individual channel join/3 functions must reject unauthenticated joins.
  def connect(_params, socket, connect_info) do
    # Try session cookie as fallback
    token =
      connect_info
      |> get_in([:session, :token])

    case token && Guilda.Accounts.get_user_by_session_token(token) do
      {:ok, user} -> {:ok, assign(socket, :current_user, user)}
      _ -> {:ok, assign(socket, :current_user, nil)}
    end
  end

  @impl true
  def id(%{assigns: %{current_user: %{id: id}}}), do: "user_socket:#{id}"
  def id(_socket), do: nil
end
