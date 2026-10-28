defmodule GuildaWeb.DmController do
  @moduledoc """
  API endpoints for Direct Messages and 1-on-1 conversations.
  """

  use GuildaWeb, :controller
  alias Guilda.{DirectMessaging, Accounts}

  # GET /api/dm
  def index(conn, _params) do
    user = conn.assigns.current_user
    conversations = DirectMessaging.list_conversations(user)
    json(conn, %{data: conversations})
  end

  # POST /api/dm
  def create(conn, params) do
    user = conn.assigns.current_user
    target = params["userId"] || params["user_id"] || params["target"] || params["email"]

    target_user =
      cond do
        is_nil(target) -> nil
        String.contains?(to_string(target), "@") -> Accounts.get_user_by_email(String.downcase(target))
        true -> Accounts.get_user(target)
      end

    case target_user do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "User not found"})

      %{id: id} when id == user.id ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "Cannot create conversation with yourself"})

      %{id: recipient_id} ->
        case DirectMessaging.get_or_create_conversation(user.id, recipient_id) do
          {:ok, conv} ->
            GuildaWeb.Endpoint.broadcast("user:#{recipient_id}", "conversation_created", %{conversation_id: conv.id})
            GuildaWeb.Endpoint.broadcast("user:#{user.id}", "conversation_created", %{conversation_id: conv.id})

            conn
            |> put_status(:created)
            |> json(%{data: serialize_conversation(conv, user.id)})

          {:error, cs} ->
            conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
        end
    end
  end

  # GET /api/dm/:id
  def show(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case DirectMessaging.get_conversation_for_user(id, user) do
      {:ok, conv} ->
        json(conn, %{data: serialize_conversation(conv, user.id)})

      {:error, :not_a_member} ->
        conn |> put_status(:forbidden) |> json(%{error: "Not a member of this conversation"})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Conversation not found"})
    end
  end

  # GET /api/dm/:id/messages
  def list_messages(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    if not DirectMessaging.member?(id, user.id) do
      conn |> put_status(:forbidden) |> json(%{error: "Not a member of this conversation"})
    else
      limit =
        case Integer.parse(params["limit"] || "50") do
          {n, ""} when n in 1..100 -> n
          _ -> 50
        end

      opts = [limit: limit, before: params["before"]]
      result = DirectMessaging.list_messages(id, opts)

      json(conn, %{
        messages: Enum.map(result.messages, &serialize_message/1),
        has_more: result.has_more
      })
    end
  end

  # POST /api/dm/:id/messages
  def create_message(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    if not DirectMessaging.member?(id, user.id) do
      conn |> put_status(:forbidden) |> json(%{error: "Not a member of this conversation"})
    else
      content = Map.get(params, "content", "")
      attachments = Map.get(params, "attachments", [])

      case DirectMessaging.create_message(id, user, %{content: content, attachments: attachments}) do
        {:ok, msg} ->
          conn |> put_status(:created) |> json(%{data: serialize_message(msg)})

        {:error, cs} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Serializers
  # ---------------------------------------------------------------------------

  defp serialize_conversation(conv, current_user_id) do
    recipient = Enum.find(conv.users, &(&1.id != current_user_id))

    %{
      id: conv.id,
      recipient: recipient && %{
        id: recipient.id,
        email: recipient.email,
        displayName: recipient.display_name,
        avatarUrl: recipient.avatar_url,
        status: recipient.status
      },
      insertedAt: conv.inserted_at
    }
  end

  defp serialize_message(m) do
    %{
      id: m.id,
      content: m.content,
      conversationId: m.conversation_id,
      authorId: m.author_id,
      authorName: m.author && m.author.display_name,
      authorAvatar: m.author && m.author.avatar_url,
      attachments: m.attachments || [],
      editedAt: m.edited_at,
      deleted: m.deleted,
      pinned: m.pinned || false,
      insertedAt: m.inserted_at
    }
  end

  defp format_errors(cs) do
    Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
  end
end
