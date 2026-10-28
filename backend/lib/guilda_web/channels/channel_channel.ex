defmodule GuildaWeb.ChannelChannel do
  @moduledoc """
  Phoenix Channel for a text channel (`channel:<channel_id>`).

  Events (client → server):
    new_message     %{content, reply_to_id?}
    edit_message    %{message_id, content}
    delete_message  %{message_id}
    add_reaction    %{message_id, emoji}
    remove_reaction %{message_id, emoji}
    typing_start    %{}
    typing_stop     %{}
    mark_read       %{message_id}

  Events (server → client):
    new_message      serialized message map
    message_edited   %{id, content, edited_at}
    message_deleted  %{id}
    reaction_added   %{message_id, emoji, user_id, count}
    reaction_removed %{message_id, emoji, user_id, count}
    typing           %{user_id, display_name, typing}
  """

  use Phoenix.Channel
  require Logger

  alias Guilda.{Channels, Servers, Messaging}
  alias Guilda.Servers.Permissions

  # ---------------------------------------------------------------------------
  # join/3 — authenticate and authorize
  # ---------------------------------------------------------------------------

  @impl true
  def join("channel:" <> channel_id, _payload, socket) do
    user = socket.assigns[:current_user]

    if is_nil(user) do
      Logger.warning("[ChannelChannel] Join rejected: unauthenticated channel_id=#{channel_id}")
      {:error, %{reason: "unauthenticated"}}
    else
      case Channels.get_channel_with_server(channel_id) do
        nil ->
          Logger.warning("[ChannelChannel] Join rejected: channel not found channel_id=#{channel_id}")
          {:error, %{reason: "channel_not_found"}}

        channel ->
          server = channel.server
          membership = Servers.get_membership(server, user)

          if is_nil(membership) do
            Logger.warning("[ChannelChannel] Join rejected: not a member channel_id=#{channel_id} user_id=#{user.id}")
            {:error, %{reason: "not_a_member"}}
          else
            socket =
              socket
              |> assign(:channel_id, channel_id)
              |> assign(:channel, channel)
              |> assign(:server, server)
              |> assign(:membership, membership)

            read_state = Messaging.get_read_state(channel_id, user.id)
            last_read_id = read_state && read_state.last_read_message_id

            Logger.info("[ChannelChannel] User joined channel_id=#{channel_id} user_id=#{user.id}")
            {:ok, %{last_read_message_id: last_read_id}, socket}
          end
      end
    end
  end

  # ---------------------------------------------------------------------------
  # new_message
  # ---------------------------------------------------------------------------

  @impl true
  def handle_in("new_message", payload, socket) do
    user = socket.assigns.current_user
    membership = socket.assigns.membership
    channel_id = socket.assigns.channel_id
    attachments = Map.get(payload, "attachments", [])

    Logger.info("[ChannelChannel] new_message received channel_id=#{channel_id} user_id=#{user.id} attachments_count=#{length(attachments)}")

    unless can_send?(membership, socket.assigns.server) do
      Logger.warning("[ChannelChannel] new_message rejected: insufficient permissions channel_id=#{channel_id} user_id=#{user.id}")
      {:reply, {:error, %{reason: "insufficient_permissions"}}, socket}
    else
      attrs = %{
        content: Map.get(payload, "content", ""),
        channel_id: channel_id,
        author_id: user.id,
        reply_to_id: Map.get(payload, "reply_to_id"),
        attachments: attachments
      }

      case Messaging.create_message(attrs) do
        {:ok, message} ->
          Logger.info("[ChannelChannel] Message created msg_id=#{message.id} channel_id=#{channel_id} attachments=#{length(message.attachments || [])}")
          broadcast!(socket, "new_message", serialize_message(message))
          {:reply, {:ok, %{id: message.id}}, socket}

        {:error, changeset} ->
          errors = format_errors(changeset)
          Logger.error("[ChannelChannel] Message creation failed errors=#{inspect(errors)} channel_id=#{channel_id}")
          {:reply, {:error, %{reason: errors}}, socket}
      end
    end
  end

  # ---------------------------------------------------------------------------
  # edit_message
  # ---------------------------------------------------------------------------

  def handle_in("edit_message", %{"message_id" => msg_id, "content" => content}, socket) do
    user = socket.assigns.current_user

    case Messaging.get_message(msg_id) do
      nil ->
        {:reply, {:error, %{reason: "not_found"}}, socket}

      msg ->
        if msg.author_id != user.id do
          {:reply, {:error, %{reason: "not_author"}}, socket}
        else
          case Messaging.edit_message(msg, %{content: content}) do
            {:ok, updated} ->
              broadcast!(socket, "message_edited", %{
                id: updated.id,
                content: updated.content,
                editedAt: updated.edited_at
              })
              {:reply, :ok, socket}

            {:error, cs} ->
              {:reply, {:error, %{reason: format_errors(cs)}}, socket}
          end
        end
    end
  end

  # ---------------------------------------------------------------------------
  # delete_message
  # ---------------------------------------------------------------------------

  def handle_in("delete_message", %{"message_id" => msg_id}, socket) do
    user = socket.assigns.current_user
    membership = socket.assigns.membership

    case Messaging.get_message(msg_id) do
      nil ->
        {:reply, {:error, %{reason: "not_found"}}, socket}

      msg ->
        can_delete =
          msg.author_id == user.id or
            Servers.has_permission?(membership, Permissions.delete_messages())

        if can_delete do
          {:ok, _} = Messaging.soft_delete_message(msg)
          broadcast!(socket, "message_deleted", %{id: msg_id})
          {:reply, :ok, socket}
        else
          {:reply, {:error, %{reason: "insufficient_permissions"}}, socket}
        end
    end
  end

  # ---------------------------------------------------------------------------
  # add_reaction / remove_reaction
  # ---------------------------------------------------------------------------

  def handle_in("add_reaction", %{"message_id" => msg_id, "emoji" => emoji}, socket) do
    user = socket.assigns.current_user

    case Messaging.add_reaction(msg_id, user.id, emoji) do
      {:ok, count} ->
        broadcast!(socket, "reaction_added", %{
          messageId: msg_id, emoji: emoji, userId: user.id, count: count
        })
        {:reply, :ok, socket}

      {:error, :already_reacted} ->
        {:reply, {:error, %{reason: "already_reacted"}}, socket}

      {:error, _} ->
        {:reply, {:error, %{reason: "failed"}}, socket}
    end
  end

  def handle_in("remove_reaction", %{"message_id" => msg_id, "emoji" => emoji}, socket) do
    user = socket.assigns.current_user

    case Messaging.remove_reaction(msg_id, user.id, emoji) do
      {:ok, count} ->
        broadcast!(socket, "reaction_removed", %{
          messageId: msg_id, emoji: emoji, userId: user.id, count: count
        })
        {:reply, :ok, socket}

      {:error, _} ->
        {:reply, {:error, %{reason: "not_found"}}, socket}
    end
  end

  # ---------------------------------------------------------------------------
  # typing indicators (ephemeral, not persisted)
  # ---------------------------------------------------------------------------

  def handle_in("typing_start", _payload, socket) do
    user = socket.assigns.current_user
    broadcast_from!(socket, "typing", %{userId: user.id, displayName: user.display_name, typing: true})
    {:noreply, socket}
  end

  def handle_in("typing_stop", _payload, socket) do
    user = socket.assigns.current_user
    broadcast_from!(socket, "typing", %{userId: user.id, displayName: user.display_name, typing: false})
    {:noreply, socket}
  end

  # ---------------------------------------------------------------------------
  # mark_read
  # ---------------------------------------------------------------------------

  def handle_in("mark_read", %{"message_id" => message_id}, socket) do
    user = socket.assigns.current_user
    channel_id = socket.assigns.channel_id

    case Ecto.UUID.cast(message_id) do
      {:ok, valid_id} ->
        Messaging.mark_read(channel_id, user.id, valid_id)

      _ ->
        :ok
    end

    {:reply, :ok, socket}
  end

  # ---------------------------------------------------------------------------
  # voice events
  # ---------------------------------------------------------------------------

  def handle_in("voice_join", payload, socket) do
    user = socket.assigns.current_user
    broadcast!(socket, "voice_user_joined", %{
      userId: user.id,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      muted: Map.get(payload, "muted", false),
      deafened: Map.get(payload, "deafened", false),
      video: Map.get(payload, "video", false),
      screenShare: Map.get(payload, "screenShare", false)
    })
    {:reply, :ok, socket}
  end

  def handle_in("voice_leave", _payload, socket) do
    user = socket.assigns.current_user
    broadcast!(socket, "voice_user_left", %{userId: user.id})
    {:reply, :ok, socket}
  end

  def handle_in("voice_state", payload, socket) do
    user = socket.assigns.current_user
    broadcast!(socket, "voice_state_updated", %{
      userId: user.id,
      muted: Map.get(payload, "muted"),
      deafened: Map.get(payload, "deafened"),
      video: Map.get(payload, "video"),
      screenShare: Map.get(payload, "screenShare"),
      speaking: Map.get(payload, "speaking")
    })
    {:reply, :ok, socket}
  end

  # ---------------------------------------------------------------------------
  # Private helpers
  # ---------------------------------------------------------------------------

  defp can_send?(membership, server) do
    server.owner_id == membership.user_id or
      Servers.has_permission?(membership, Permissions.send_messages())
  end

  defp serialize_message(msg) do
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
      reactions: serialize_reactions(msg.reactions),
      attachments: attachments,
      insertedAt: msg.inserted_at
    }
  end

  defp serialize_reactions(reactions) when is_list(reactions) do
    reactions
    |> Enum.group_by(& &1.emoji)
    |> Enum.map(fn {emoji, list} ->
      %{emoji: emoji, count: length(list), userIds: Enum.map(list, & &1.user_id)}
    end)
  end

  defp serialize_reactions(_), do: []

  defp format_errors(cs) do
    Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
  end
end
