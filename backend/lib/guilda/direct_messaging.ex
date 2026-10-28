defmodule Guilda.DirectMessaging do
  @moduledoc """
  The DirectMessaging context.

  Handles 1-on-1 private conversations and direct messages.
  """

  import Ecto.Query, warn: false
  alias Guilda.Repo
  alias Guilda.Accounts.User
  alias Guilda.DirectMessaging.{Conversation, ConversationMember, DirectMessage}

  # ---------------------------------------------------------------------------
  # Conversations
  # ---------------------------------------------------------------------------

  @doc """
  Gets an existing 1-on-1 conversation between user_a and user_b, or creates a new one.
  """
  def get_or_create_conversation(user_a_id, user_b_id) do
    if user_a_id == user_b_id do
      {:error, :cannot_message_self}
    else
      case find_conversation_between(user_a_id, user_b_id) do
        %Conversation{} = conv ->
          {:ok, conv}

        nil ->
          create_conversation_between(user_a_id, user_b_id)
      end
    end
  end

  defp find_conversation_between(user_a_id, user_b_id) do
    # Find conversation IDs where both users are members
    query =
      from cm1 in ConversationMember,
        join: cm2 in ConversationMember,
        on: cm1.conversation_id == cm2.conversation_id,
        where: cm1.user_id == ^user_a_id and cm2.user_id == ^user_b_id,
        select: cm1.conversation_id,
        limit: 1

    case Repo.one(query) do
      nil -> nil
      conv_id -> get_conversation_by_id(conv_id)
    end
  end

  defp create_conversation_between(user_a_id, user_b_id) do
    Repo.transaction(fn ->
      conv = %Conversation{} |> Conversation.changeset() |> Repo.insert!()

      %ConversationMember{conversation_id: conv.id, user_id: user_a_id} |> Repo.insert!()
      %ConversationMember{conversation_id: conv.id, user_id: user_b_id} |> Repo.insert!()

      get_conversation_by_id(conv.id)
    end)
  end

  @doc "Gets a conversation by id with preloaded users."
  def get_conversation_by_id(id) do
    Repo.one(
      from c in Conversation,
        where: c.id == ^id,
        preload: [users: ^from(u in User, select: [:id, :email, :display_name, :avatar_url, :status])]
    )
  end

  @doc "Gets a conversation by id if the user is a member."
  def get_conversation_for_user(conversation_id, %User{id: user_id}) do
    if member?(conversation_id, user_id) do
      case get_conversation_by_id(conversation_id) do
        nil -> {:error, :not_found}
        conv -> {:ok, conv}
      end
    else
      {:error, :not_a_member}
    end
  end

  @doc "Returns true if user is member of conversation."
  def member?(conversation_id, user_id) do
    Repo.exists?(
      from cm in ConversationMember,
        where: cm.conversation_id == ^conversation_id and cm.user_id == ^user_id
    )
  end

  @doc """
  Lists all direct conversations for a user, serialized with the recipient's info
  and the latest message.
  """
  def list_conversations(%User{id: user_id}) do
    convs =
      Repo.all(
        from c in Conversation,
          join: cm in ConversationMember,
          on: cm.conversation_id == c.id and cm.user_id == ^user_id,
          preload: [users: ^from(u in User, select: [:id, :email, :display_name, :avatar_url, :status])],
          order_by: [desc: c.inserted_at]
      )

    Enum.map(convs, fn c ->
      recipient = Enum.find(c.users, &(&1.id != user_id))
      last_message = get_last_message(c.id)

      %{
        id: c.id,
        recipient: recipient && %{
          id: recipient.id,
          email: recipient.email,
          displayName: recipient.display_name,
          avatarUrl: recipient.avatar_url,
          status: recipient.status
        },
        lastMessage: last_message && %{
          id: last_message.id,
          content: last_message.content,
          authorId: last_message.author_id,
          insertedAt: last_message.inserted_at
        },
        insertedAt: c.inserted_at
      }
    end)
  end

  defp get_last_message(conversation_id) do
    Repo.one(
      from m in DirectMessage,
        where: m.conversation_id == ^conversation_id,
        order_by: [desc: m.inserted_at],
        limit: 1
    )
  end

  @doc "Lists member IDs of a conversation."
  def list_member_ids(conversation_id) do
    Repo.all(
      from cm in ConversationMember,
        where: cm.conversation_id == ^conversation_id,
        select: cm.user_id
    )
  end

  # ---------------------------------------------------------------------------
  # Messages
  # ---------------------------------------------------------------------------

  @doc """
  Lists direct messages for a conversation with keyset pagination.
  """
  def list_messages(conversation_id, opts \\ []) do
    limit = Keyword.get(opts, :limit, 50)
    before_id = Keyword.get(opts, :before)

    base =
      from m in DirectMessage,
        where: m.conversation_id == ^conversation_id,
        preload: [author: ^from(u in User, select: [:id, :display_name, :avatar_url])],
        order_by: [desc: m.inserted_at, desc: m.id],
        limit: ^(limit + 1)

    query =
      if before_id do
        case Repo.get(DirectMessage, before_id) do
          nil -> base
          ref ->
            from m in base,
              where: m.inserted_at < ^ref.inserted_at or (m.inserted_at == ^ref.inserted_at and m.id < ^ref.id)
        end
      else
        base
      end

    results = Repo.all(query)
    has_more = length(results) > limit
    messages = results |> Enum.take(limit) |> Enum.reverse()

    %{messages: messages, has_more: has_more}
  end

  @doc "Gets a message by id."
  def get_message(id) do
    Repo.get(DirectMessage, id) |> Repo.preload(:author)
  end

  @doc "Creates a direct message in a conversation."
  def create_message(conversation_id, %User{id: author_id}, attrs) do
    %DirectMessage{}
    |> DirectMessage.changeset(
      attrs
      |> Map.put(:conversation_id, conversation_id)
      |> Map.put(:author_id, author_id)
    )
    |> Repo.insert()
    |> case do
      {:ok, msg} -> {:ok, Repo.preload(msg, :author)}
      err -> err
    end
  end

  @doc "Edits a direct message."
  def edit_message(%DirectMessage{} = msg, attrs) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    msg
    |> DirectMessage.changeset(Map.put(attrs, :edited_at, now))
    |> Repo.update()
    |> case do
      {:ok, updated} -> {:ok, Repo.preload(updated, :author)}
      err -> err
    end
  end

  @doc "Soft-deletes a direct message."
  def soft_delete_message(%DirectMessage{} = msg) do
    msg
    |> DirectMessage.changeset(%{deleted: true, content: "[deleted]"})
    |> Repo.update()
  end

  @doc "Pins a direct message."
  def pin_message(%DirectMessage{} = msg) do
    msg
    |> DirectMessage.pin_changeset(true)
    |> Repo.update()
    |> case do
      {:ok, updated} -> {:ok, Repo.preload(updated, :author)}
      err -> err
    end
  end

  @doc "Unpins a direct message."
  def unpin_message(%DirectMessage{} = msg) do
    msg
    |> DirectMessage.pin_changeset(false)
    |> Repo.update()
    |> case do
      {:ok, updated} -> {:ok, Repo.preload(updated, :author)}
      err -> err
    end
  end

  @doc "Lists pinned direct messages in a conversation."
  def list_pinned_messages(conversation_id) do
    from(m in DirectMessage,
      where: m.conversation_id == ^conversation_id and m.pinned == true and m.deleted == false,
      preload: [author: ^from(u in User, select: [:id, :display_name, :avatar_url])],
      order_by: [desc: m.inserted_at]
    )
    |> Repo.all()
  end
end
