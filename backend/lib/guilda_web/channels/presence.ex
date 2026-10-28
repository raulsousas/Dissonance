defmodule GuildaWeb.Presence do
  @moduledoc """
  Provides presence tracking to channels and processes.
  Tracks online status of users across channels and the global presence topic.
  """
  use Phoenix.Presence,
    otp_app: :guilda,
    pubsub_server: Guilda.PubSub

  alias Guilda.Accounts.User

  @doc """
  Returns a map of online user IDs and their presence metadata for given topic (default "presence:global").
  """
  def list_online_users(topic \\ "presence:global") do
    list(topic)
  end

  @doc """
  Checks if a user is online in the given topic (default "presence:global").
  """
  def online?(user_id, topic \\ "presence:global") do
    case get_by_key(topic, to_string(user_id)) do
      %{metas: metas} when is_list(metas) and length(metas) > 0 -> true
      _ -> false
    end
  end

  @doc """
  Gets presence metadata for a user in the given topic.
  """
  def get_user_presence(user_id, topic \\ "presence:global") do
    case get_by_key(topic, to_string(user_id)) do
      %{metas: [meta | _]} ->
        %{
          userId: user_id,
          online: true,
          status: meta[:status] || "online",
          displayName: meta[:display_name],
          avatarUrl: meta[:avatar_url],
          onlineAt: meta[:online_at]
        }

      _ ->
        %{
          userId: user_id,
          online: false,
          status: "offline"
        }
    end
  end

  @doc """
  Tracks user presence with custom metadata.
  """
  def track_user(socket, %User{} = user, meta \\ %{}) do
    default_meta = %{
      user_id: user.id,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      status: user.status || "online",
      online_at: System.system_time(:second)
    }

    track(socket, to_string(user.id), Map.merge(default_meta, meta))
  end
end
