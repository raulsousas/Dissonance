defmodule GuildaWeb.UserSocket do
  use Phoenix.Socket

  channel "channel:*",  GuildaWeb.ChannelChannel
  channel "dm:*",       GuildaWeb.DmChannel
  channel "user:*",     GuildaWeb.UserChannel
  channel "presence:*", GuildaWeb.PresenceChannel

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
    require Logger

    token =
      case connect_info do
        %{session: %{"token" => t}} -> t
        %{session: %{token: t}} -> t
        _ ->
          get_in(connect_info, [:session, :token]) ||
            get_in(connect_info, [:session, "token"])
      end

    case token && Guilda.Accounts.get_user_by_session_token(token) do
      {:ok, user} ->
        Logger.info("[UserSocket.connect] authenticated user_id=#{user.id}")
        {:ok, assign(socket, :current_user, user)}

      _ ->
        Logger.warning("[UserSocket.connect] unauthenticated connection")
        {:ok, assign(socket, :current_user, nil)}
    end
  end

  @impl true
  def id(%{assigns: %{current_user: %{id: id}}}), do: "user_socket:#{id}"
  def id(_socket), do: nil
end
