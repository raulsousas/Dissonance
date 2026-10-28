defmodule GuildaWeb.PresenceChannel do
  @moduledoc """
  Phoenix Channel for tracking real-time global presence (`presence:global`).
  """

  use Phoenix.Channel
  alias GuildaWeb.Presence

  @impl true
  def join("presence:global", _payload, socket) do
    case socket.assigns[:current_user] do
      nil ->
        {:error, %{reason: "unauthenticated"}}

      _user ->
        send(self(), :after_join)
        {:ok, socket}
    end
  end

  @impl true
  def handle_info(:after_join, socket) do
    user = socket.assigns.current_user

    if user.status != "invisible" do
      {:ok, _} =
        Presence.track(socket, user.id, %{
          user_id: user.id,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          status: user.status || "online",
          voice_channel_id: nil,
          online_at: System.system_time(:second)
        })
    end

    push(socket, "presence_state", Presence.list(socket))
    {:noreply, socket}
  end

  @impl true
  def handle_in("update_status", %{"status" => status}, socket) do
    user = socket.assigns.current_user

    cond do
      status == "invisible" ->
        Presence.untrack(socket, user.id)

      Presence.get_by_key(socket, user.id) == nil ->
        Presence.track(socket, user.id, %{
          user_id: user.id,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          status: status,
          voice_channel_id: nil,
          online_at: System.system_time(:second)
        })

      true ->
        Presence.update(socket, user.id, fn meta ->
          Map.put(meta, :status, status)
        end)
    end

    {:reply, :ok, socket}
  end

  @impl true
  def handle_in("update_voice_channel", %{"voice_channel_id" => voice_channel_id}, socket) do
    user = socket.assigns.current_user

    cond do
      Presence.get_by_key(socket, user.id) == nil ->
        Presence.track(socket, user.id, %{
          user_id: user.id,
          display_name: user.display_name,
          avatar_url: user.avatar_url,
          status: user.status || "online",
          voice_channel_id: voice_channel_id,
          online_at: System.system_time(:second)
        })

      true ->
        Presence.update(socket, user.id, fn meta ->
          Map.put(meta, :voice_channel_id, voice_channel_id)
        end)
    end

    {:reply, :ok, socket}
  end
end
