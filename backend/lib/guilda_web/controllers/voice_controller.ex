defmodule GuildaWeb.VoiceController do
  @moduledoc """
  Controller for voice channel authentication and LiveKit room token issuance.
  """

  use GuildaWeb, :controller
  require Logger
  alias Guilda.Voice

  # POST /api/channels/:channel_id/voice/token
  def token(conn, %{"channel_id" => channel_id}) do
    user = conn.assigns.current_user
    Logger.info("[VoiceController] Token requested channel_id=#{channel_id} user_id=#{user && user.id}")

    case Voice.issue_token(channel_id, user) do
      {:ok, data} ->
        Logger.info("[VoiceController] Token issued successfully channel_id=#{channel_id} room=#{data.room}")
        json(conn, %{data: data})

      {:error, :channel_not_found} ->
        Logger.warning("[VoiceController] Channel not found channel_id=#{channel_id}")
        conn |> put_status(:not_found) |> json(%{error: "Channel not found"})

      {:error, :not_a_voice_channel} ->
        Logger.warning("[VoiceController] Not a voice channel channel_id=#{channel_id}")
        conn |> put_status(:bad_request) |> json(%{error: "Channel is not a voice channel"})

      {:error, :not_a_member} ->
        Logger.warning("[VoiceController] Not a server member channel_id=#{channel_id} user_id=#{user.id}")
        conn |> put_status(:forbidden) |> json(%{error: "You are not a member of this server"})

      {:error, :permission_denied} ->
        Logger.warning("[VoiceController] Permission denied channel_id=#{channel_id} user_id=#{user.id}")
        conn |> put_status(:forbidden) |> json(%{error: "You do not have permission to join voice in this channel"})
    end
  end

  # POST /api/channels/:channel_id/voice/leave
  def leave(conn, %{"channel_id" => channel_id}) do
    user = conn.assigns.current_user
    Logger.info("[VoiceController] User left voice channel_id=#{channel_id} user_id=#{user && user.id}")
    send_resp(conn, :no_content, "")
  end
end
