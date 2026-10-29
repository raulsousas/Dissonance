defmodule GuildaWeb.MessagesController do
  @moduledoc """
  REST API for channel message history and HTTP fallback send.

  Endpoints:
    GET    /api/channels/:channel_id/messages           — paginated history
    POST   /api/channels/:channel_id/messages           — HTTP fallback send
  """

  use GuildaWeb, :controller
  import Ecto.Query

  alias Guilda.{Channels, Servers, Messaging}

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp load_channel_and_membership(conn, channel_id) do
    user = conn.assigns.current_user

    case Channels.get_channel_with_server(channel_id) do
      nil ->
        {:error, :not_found}

      channel ->
        membership = Servers.get_membership(channel.server, user)

        if is_nil(membership) do
          {:error, :forbidden}
        else
          {:ok, channel, membership}
        end
    end
  end

  @doc false
  def serialize_message(msg) do
    reactions =
      (msg.reactions || [])
      |> Enum.group_by(& &1.emoji)
      |> Enum.map(fn {emoji, list} ->
        %{emoji: emoji, count: length(list), userIds: Enum.map(list, & &1.user_id)}
      end)

    attachments =
      (msg.attachments || [])
      |> Enum.map(fn att ->
        %{
          id: att.id,
          url: att.url,
          filename: att.filename,
          size: att.size,
          contentType: att.content_type,
          width: att.width,
          height: att.height
        }
      end)

    %{
      id: msg.id,
      content: msg.content,
      channelId: msg.channel_id,
      authorId: msg.author_id,
      authorName: msg.author && msg.author.display_name,
      authorAvatar: msg.author && msg.author.avatar_url,
      replyToId: msg.reply_to_id,
      editedAt: msg.edited_at,
      deleted: msg.deleted,
      pinned: msg.pinned || false,
      kind: msg.kind || "user",
      reactions: reactions,
      attachments: attachments,
      insertedAt: msg.inserted_at
    }
  end

  # ---------------------------------------------------------------------------
  # GET /api/channels/:channel_id/messages
  # ---------------------------------------------------------------------------

  def index(conn, %{"channel_id" => channel_id} = params) do
    case load_channel_and_membership(conn, channel_id) do
      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "channel not found"})

      {:error, :forbidden} ->
        conn |> put_status(403) |> json(%{error: "not a member"})

      {:ok, _channel, _membership} ->
        before_id = params["before"]
        limit = min(String.to_integer(params["limit"] || "50"), 100)

        messages = Messaging.list_messages(channel_id, before_id: before_id, limit: limit)

        json(conn, %{
          messages: Enum.map(messages, &serialize_message/1),
          has_more: length(messages) == limit
        })
    end
  end

  # ---------------------------------------------------------------------------
  # POST /api/channels/:channel_id/messages  (HTTP fallback)
  # ---------------------------------------------------------------------------

  def create(conn, %{"channel_id" => channel_id} = params) do
    case load_channel_and_membership(conn, channel_id) do
      {:error, :not_found} ->
        conn |> put_status(404) |> json(%{error: "channel not found"})

      {:error, :forbidden} ->
        conn |> put_status(403) |> json(%{error: "not a member"})

      {:ok, %{type: "polls"}, _membership} ->
        conn |> put_status(422) |> json(%{error: "channel does not accept messages"})

      {:ok, channel, membership} ->
        user = conn.assigns.current_user

        unless Servers.has_permission?(membership, Guilda.Servers.Permissions.send_messages()) or
                 channel.server.owner_id == user.id do
          conn |> put_status(403) |> json(%{error: "insufficient permissions"})
        else
          attrs = %{
            content: params["content"],
            channel_id: channel_id,
            author_id: user.id,
            reply_to_id: params["reply_to_id"],
            attachments: params["attachments"] || []
          }

          case Messaging.create_message(attrs) do
            {:ok, message} ->
              serialized = serialize_message(message)
              # Broadcast via Phoenix PubSub so WebSocket subscribers receive it
              GuildaWeb.Endpoint.broadcast("channel:#{channel_id}", "new_message", serialized)

              # Notify other members of this server
              server = channel.server
              server_id = server.id
              author_id = user.id

              # Users in focus mode (channel silenced) are not notified.
              member_user_ids =
                Guilda.Repo.all(
                  from sm in Guilda.Servers.ServerMember,
                    where: sm.server_id == ^server_id and sm.user_id != ^author_id,
                    select: sm.user_id
                )
                |> Guilda.FocusMode.reject_muted(channel_id)

              Enum.each(member_user_ids, fn member_id ->
                GuildaWeb.Endpoint.broadcast("user:#{member_id}", "new_server_message", %{
                  serverId: server_id,
                  channelId: channel_id,
                  channelName: channel.name,
                  serverName: server.name,
                  message: serialized
                })
              end)

              conn |> put_status(201) |> json(%{message: serialized})

            {:error, changeset} ->
              errors =
                Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)

              conn |> put_status(422) |> json(%{errors: errors})
          end
        end
    end
  end
end
