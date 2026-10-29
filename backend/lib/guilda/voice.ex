defmodule Guilda.Voice do
  @moduledoc """
  The Voice context.

  Handles permission verification and LiveKit JWT access token issuance for voice channels.
  """

  import Ecto.Query, warn: false
  alias Guilda.Repo
  alias Guilda.Accounts.User
  alias Guilda.Channels.Channel
  alias Guilda.Servers.{Server, ServerMember, Permissions}

  @doc """
  Issues a LiveKit access token for `user` to join voice channel `channel_id`.
  Verifies that:
  - Channel exists and is of type `"voice"`
  - User is a member of the channel's server
  - User has `connect_voice` permission
  """
  def issue_token(channel_id, %User{} = user) do
    case Repo.get(Channel, channel_id) |> Repo.preload(:server) do
      nil ->
        {:error, :channel_not_found}

      %Channel{type: type} when type != "voice" ->
        {:error, :not_a_voice_channel}

      %Channel{server: %Server{} = server} = channel ->
        permissions = get_user_server_permissions(server, user)

        if is_nil(permissions) do
          {:error, :not_a_member}
        else
          if not Permissions.has_permission?(permissions, Permissions.connect_voice()) do
            {:error, :permission_denied}
          else
            can_speak = Permissions.has_permission?(permissions, Permissions.speak_voice())
            can_video = Permissions.has_permission?(permissions, Permissions.video())

            token = generate_livekit_token(channel.id, user, can_speak: can_speak, can_video: can_video)
            livekit_url = System.get_env("LIVEKIT_URL", "http://localhost:7880")

            {:ok,
             %{
               token: token,
               url: livekit_url,
               room: channel.id,
               canSpeak: can_speak,
               canVideo: can_video
             }}
          end
        end
    end
  end

  @doc "Returns the permission integer for a user on a given server, or nil if not a member."
  def get_user_server_permissions(%Server{owner_id: owner_id}, %User{id: user_id})
      when owner_id == user_id do
    Permissions.all_permissions()
  end

  def get_user_server_permissions(%Server{id: server_id}, %User{id: user_id}) do
    case Repo.get_by(ServerMember, server_id: server_id, user_id: user_id) |> Repo.preload(:role) do
      nil ->
        nil

      %ServerMember{role: %{permissions: perms}} ->
        perms

      %ServerMember{} ->
        Permissions.default_permissions()
    end
  end

  @doc "Generates a signed LiveKit JWT access token."
  def generate_livekit_token(room_name, %User{} = user, opts \\ []) do
    api_key = System.get_env("LIVEKIT_API_KEY", "devkey")
    api_secret = System.get_env("LIVEKIT_API_SECRET", "secret")

    now = System.system_time(:second)
    exp = now + Keyword.get(opts, :ttl, 3600 * 6)

    can_speak = Keyword.get(opts, :can_speak, true)

    header = %{
      "alg" => "HS256",
      "typ" => "JWT"
    }

    payload = %{
      "iss" => api_key,
      "sub" => to_string(user.id),
      "name" => user.display_name,
      "nbf" => now - 5,
      "exp" => exp,
      "video" => %{
        "room" => room_name,
        "roomJoin" => true,
        "canPublish" => can_speak,
        "canSubscribe" => true,
        "canPublishData" => true,
        # The client broadcasts its mute/deafen state through participant metadata.
        "canUpdateOwnMetadata" => true
      }
    }

    encode_jwt(header, payload, api_secret)
  end

  defp encode_jwt(header, payload, secret) do
    header_b64 = header |> Jason.encode!() |> Base.url_encode64(padding: false)
    payload_b64 = payload |> Jason.encode!() |> Base.url_encode64(padding: false)
    signing_input = header_b64 <> "." <> payload_b64
    signature = :crypto.mac(:hmac, :sha256, secret, signing_input) |> Base.url_encode64(padding: false)

    signing_input <> "." <> signature
  end
end
