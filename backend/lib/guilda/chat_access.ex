defmodule Guilda.ChatAccess do
  @moduledoc """
  Single place that answers "can this user see this chat?".

  A chat is either a server channel (`"channel"`) or a direct message
  conversation (`"dm"`). Used by polls, reminders, search and focus mode.
  """

  alias Guilda.{Channels, DirectMessaging, Servers}
  alias Guilda.Accounts.User

  def can_access?(%User{} = user, "channel", channel_id) do
    with true <- valid_uuid?(channel_id),
         %{server: server} when not is_nil(server) <- Channels.get_channel_with_server(channel_id) do
      Servers.member?(server, user)
    else
      _ -> false
    end
  end

  def can_access?(%User{id: user_id}, "dm", conversation_id) do
    valid_uuid?(conversation_id) and DirectMessaging.member?(conversation_id, user_id)
  end

  def can_access?(_user, _scope, _id), do: false

  @doc "True for a well-formed UUID string."
  def valid_uuid?(value) when is_binary(value), do: match?({:ok, _}, Ecto.UUID.cast(value))
  def valid_uuid?(_), do: false
end
