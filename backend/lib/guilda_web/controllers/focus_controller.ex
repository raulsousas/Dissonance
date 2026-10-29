defmodule GuildaWeb.FocusController do
  @moduledoc """
  Focus mode (silenced channels).

    GET    /api/focus/muted                      — channels the user silenced
    PUT    /api/channels/:channel_id/mute        — silence a channel
    DELETE /api/channels/:channel_id/mute        — re-enable a channel
    GET    /api/channels/:channel_id/focus-summary — what was missed while silenced
  """

  use GuildaWeb, :controller

  alias Guilda.FocusMode

  def index(conn, _params) do
    muted = FocusMode.list_muted(conn.assigns.current_user)
    json(conn, %{muted: Enum.map(muted, &%{channelId: &1.channel_id, mutedAt: &1.muted_at})})
  end

  def mute(conn, %{"channel_id" => channel_id}) do
    case FocusMode.mute(conn.assigns.current_user, channel_id) do
      {:ok, muted_at} -> json(conn, %{channelId: channel_id, mutedAt: muted_at})
      {:error, :not_found} -> not_found(conn)
    end
  end

  def unmute(conn, %{"channel_id" => channel_id}) do
    :ok = FocusMode.unmute(conn.assigns.current_user, channel_id)
    send_resp(conn, 204, "")
  end

  def summary(conn, %{"channel_id" => channel_id}) do
    case FocusMode.summary(conn.assigns.current_user, channel_id) do
      {:ok, summary} -> json(conn, %{summary: summary})
      {:error, :not_found} -> not_found(conn)
    end
  end

  defp not_found(conn), do: conn |> put_status(404) |> json(%{error: "channel not found"})
end
