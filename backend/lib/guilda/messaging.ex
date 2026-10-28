defmodule Guilda.Messaging do
  @moduledoc """
  The Messaging context.

  Handles channel messages, reactions, attachments, and direct messages.
  """

  import Ecto.Query

  alias Guilda.Repo
  alias Guilda.Messaging.{Message, Reaction}

  # ---------------------------------------------------------------------------
  # Messages
  # ---------------------------------------------------------------------------

  @doc """
  Create a new message in a channel.
  Preloads `:author` and `:reactions` on success.
  """
  def create_message(attrs) do
    attachments_data = Map.get(attrs, :attachments) || Map.get(attrs, "attachments") || []

    Ecto.Multi.new()
    |> Ecto.Multi.insert(:message, Message.changeset(%Message{}, attrs))
    |> Ecto.Multi.run(:attachments, fn repo, %{message: message} ->
      Enum.reduce_while(attachments_data, {:ok, []}, fn att_attrs, {:ok, acc} ->
        att_attrs =
          att_attrs
          |> Enum.map(fn {k, v} -> {to_string(k), v} end)
          |> Map.new()
          |> Map.put("message_id", message.id)

        case repo.insert(Guilda.Messaging.Attachment.changeset(%Guilda.Messaging.Attachment{}, att_attrs)) do
          {:ok, att} -> {:cont, {:ok, [att | acc]}}
          {:error, cs} -> {:halt, {:error, cs}}
        end
      end)
    end)
    |> Repo.transaction()
    |> case do
      {:ok, %{message: msg}} ->
        {:ok, Repo.preload(msg, [:author, :attachments, reactions: [:user]])}

      {:error, _step, error, _changes} ->
        {:error, error}
    end
  end

  @doc "Fetch a single message by id. Returns nil if not found."
  def get_message(id) do
    Repo.get(Message, id)
  end

  @doc "Fetch a single message with its author preloaded."
  def get_message_with_author(id) do
    Repo.get(Message, id) |> Repo.preload(:author)
  end

  @doc """
  Paginated message history for a channel.

  Options:
    - `before_id` — return messages with inserted_at < that of `before_id`
    - `limit`     — max messages to return (default 50, max 100)

  Returns messages in ascending order (oldest first within the page).
  """
  def list_messages(channel_id, opts \\ []) do
    limit = min(opts[:limit] || 50, 100)
    before_id = opts[:before_id]

    base =
      from m in Message,
        where: m.channel_id == ^channel_id and m.deleted == false,
        order_by: [desc: m.inserted_at, desc: m.id],
        limit: ^limit,
        preload: [:author, :attachments, reactions: [:user]]

    query =
      if before_id do
        case Repo.get(Message, before_id) do
          nil ->
            base

          pivot ->
            from m in base,
              where:
                m.inserted_at < ^pivot.inserted_at or
                  (m.inserted_at == ^pivot.inserted_at and m.id < ^pivot.id)
        end
      else
        base
      end

    # Fetch newest-first then reverse so the page is oldest→newest for display
    query
    |> Repo.all()
    |> Enum.reverse()
  end

  @doc "Count unread messages in a channel after `last_read_message_id`."
  def count_unread(channel_id, last_read_message_id) do
    case last_read_message_id && Repo.get(Message, last_read_message_id) do
      nil ->
        Repo.aggregate(
          from(m in Message, where: m.channel_id == ^channel_id and m.deleted == false),
          :count
        )

      pivot ->
        Repo.aggregate(
          from(m in Message,
            where:
              m.channel_id == ^channel_id and m.deleted == false and
                (m.inserted_at > ^pivot.inserted_at or
                   (m.inserted_at == ^pivot.inserted_at and m.id > ^pivot.id))
          ),
          :count
        )
    end
  end

  @doc "Edit a message. Only the author should call this."
  def edit_message(%Message{} = msg, attrs) do
    msg
    |> Message.edit_changeset(attrs)
    |> Repo.update()
  end

  @doc "Soft-delete a message: sets deleted=true, blanks content."
  def soft_delete_message(%Message{} = msg) do
    msg
    |> Ecto.Changeset.change(%{deleted: true, content: "[deleted]"})
    |> Repo.update()
  end

  # ---------------------------------------------------------------------------
  # Read state
  # ---------------------------------------------------------------------------

  alias Guilda.Messaging.ReadState

  @doc """
  Upsert the last-read position for a user in a channel.
  """
  def mark_read(channel_id, user_id, message_id) do
    case Ecto.UUID.cast(message_id) do
      {:ok, valid_msg_id} ->
        now = DateTime.utc_now() |> DateTime.truncate(:second)

        Repo.insert!(
          %ReadState{
            channel_id: channel_id,
            user_id: user_id,
            last_read_message_id: valid_msg_id,
            last_read_at: now
          },
          on_conflict: [set: [last_read_message_id: valid_msg_id, last_read_at: now, updated_at: now]],
          conflict_target: [:channel_id, :user_id]
        )

        :ok

      _ ->
        :ok
    end
  end

  @doc "Get the read state for a user in a channel. Returns nil if never read."
  def get_read_state(channel_id, user_id) do
    Repo.get_by(ReadState, channel_id: channel_id, user_id: user_id)
  end

  # ---------------------------------------------------------------------------
  # Reactions
  # ---------------------------------------------------------------------------

  @doc "Add an emoji reaction. Returns {:ok, count} or {:error, reason}."
  def add_reaction(message_id, user_id, emoji) do
    %Reaction{}
    |> Reaction.changeset(%{message_id: message_id, user_id: user_id, emoji: emoji})
    |> Repo.insert()
    |> case do
      {:ok, _} ->
        count = reaction_count(message_id, emoji)
        {:ok, count}

      {:error, %Ecto.Changeset{errors: [{_, {"already reacted with this emoji", _}} | _]}} ->
        {:error, :already_reacted}

      {:error, cs} ->
        {:error, cs}
    end
  end

  @doc "Remove an emoji reaction. Returns {:ok, count} or {:error, :not_found}."
  def remove_reaction(message_id, user_id, emoji) do
    case Repo.get_by(Reaction, message_id: message_id, user_id: user_id, emoji: emoji) do
      nil ->
        {:error, :not_found}

      reaction ->
        Repo.delete!(reaction)
        count = reaction_count(message_id, emoji)
        {:ok, count}
    end
  end

  defp reaction_count(message_id, emoji) do
    Repo.aggregate(
      from(r in Reaction, where: r.message_id == ^message_id and r.emoji == ^emoji),
      :count
    )
  end
end
