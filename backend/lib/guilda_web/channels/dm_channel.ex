defmodule GuildaWeb.DmChannel do
  @moduledoc """
  Phoenix Channel for 1-on-1 Direct Messages (`dm:<conversation_id>`).
  """

  use Phoenix.Channel
  alias Guilda.DirectMessaging

  @impl true
  def join("dm:" <> conversation_id, _payload, socket) do
    user = socket.assigns[:current_user]

    cond do
      is_nil(user) ->
        {:error, %{reason: "unauthenticated"}}

      not DirectMessaging.member?(conversation_id, user.id) ->
        {:error, %{reason: "not_a_member"}}

      true ->
        {:ok, assign(socket, :conversation_id, conversation_id)}
    end
  end

  @impl true
  def handle_in("new_message", %{"content" => content}, socket) do
    user = socket.assigns.current_user
    conv_id = socket.assigns.conversation_id

    case DirectMessaging.create_message(conv_id, user, %{content: content}) do
      {:ok, message} ->
        broadcast!(socket, "new_message", serialize_message(message))

        # Notify other member(s) via their personal notification channel
        DirectMessaging.list_member_ids(conv_id)
        |> Enum.reject(&(&1 == user.id))
        |> Enum.each(fn recipient_id ->
          GuildaWeb.Endpoint.broadcast("user:#{recipient_id}", "new_dm", %{
            conversationId: conv_id,
            message: serialize_message(message)
          })
        end)

        {:reply, {:ok, %{id: message.id}}, socket}

      {:error, cs} ->
        {:reply, {:error, %{reason: format_errors(cs)}}, socket}
    end
  end

  def handle_in("edit_message", %{"message_id" => msg_id, "content" => content}, socket) do
    user = socket.assigns.current_user

    case DirectMessaging.get_message(msg_id) do
      nil ->
        {:reply, {:error, %{reason: "not_found"}}, socket}

      msg ->
        if msg.author_id != user.id do
          {:reply, {:error, %{reason: "not_author"}}, socket}
        else
          case DirectMessaging.edit_message(msg, %{content: content}) do
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

  def handle_in("delete_message", %{"message_id" => msg_id}, socket) do
    user = socket.assigns.current_user

    case DirectMessaging.get_message(msg_id) do
      nil ->
        {:reply, {:error, %{reason: "not_found"}}, socket}

      msg ->
        if msg.author_id != user.id do
          {:reply, {:error, %{reason: "not_author"}}, socket}
        else
          {:ok, _} = DirectMessaging.soft_delete_message(msg)
          broadcast!(socket, "message_deleted", %{id: msg_id})
          {:reply, :ok, socket}
        end
    end
  end

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

  defp serialize_message(m) do
    %{
      id: m.id,
      content: m.content,
      conversationId: m.conversation_id,
      authorId: m.author_id,
      authorName: m.author && m.author.display_name,
      authorAvatar: m.author && m.author.avatar_url,
      editedAt: m.edited_at,
      deleted: m.deleted,
      insertedAt: m.inserted_at
    }
  end

  defp format_errors(cs) do
    Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
  end
end
