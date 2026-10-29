defmodule Guilda.Messaging do
  @moduledoc """
  The Messaging context.

  Handles channel messages, reactions, attachments, and direct messages.
  """

  import Ecto.Query

  alias Guilda.Repo
  alias Guilda.Accounts.User
  alias Guilda.Messaging.{Message, Reaction, Attachment}

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

  @doc """
  Posts the automatic welcome message for a user who just joined a server.

  The message is authored by the new member (messages require an author) but is
  flagged `kind: "welcome"`, which clients cannot set. It goes to the server's
  first text channel. Returns `{:ok, message}`, or `{:error, :no_text_channel}`.
  """
  def create_welcome_message(%Guilda.Servers.Server{} = server, %User{} = user) do
    case server |> Guilda.Channels.list_channels() |> Enum.find(&(&1.type == "text")) do
      nil ->
        {:error, :no_text_channel}

      channel ->
        content = "Bem-vindo(a) a #{server.name}, @#{user.display_name}! Fique à vontade 🎉"

        %Message{kind: "welcome"}
        |> Message.changeset(%{content: content, channel_id: channel.id, author_id: user.id})
        |> Repo.insert()
        |> case do
          {:ok, msg} -> {:ok, Repo.preload(msg, [:author, :attachments, reactions: [:user]])}
          {:error, cs} -> {:error, cs}
        end
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

  @search_max_text 100
  @link_regex "https?://|www\\."

  @doc """
  Searches the text channels of a server.

  The caller is responsible for checking server membership.

  Options (all optional, but at least one of `:text`, `:from`, `:has`, `:pinned`
  is required — otherwise `[]` is returned):
    - `:text`       — case-insensitive substring of the content
    - `:from`       — case-insensitive substring of the author's display name
    - `:has`        — `"link"`, `"attachment"` or `"image"`
    - `:pinned`     — `true` to only return pinned messages
    - `:channel_id` — restrict to one channel of the server
    - `:before_id`  — cursor: only messages older than this one
    - `:limit`      — page size (default 25, max 50)

  Returns `%{results: [{message, channel_name}], has_more: boolean}`, newest first.
  """
  def search_messages(server_id, opts \\ []) do
    limit = min(opts[:limit] || 25, 50)
    text = normalize_search_text(opts[:text])
    from_name = normalize_search_text(opts[:from])
    has = opts[:has]
    pinned? = opts[:pinned] == true

    if is_nil(text) and is_nil(from_name) and is_nil(has) and not pinned? do
      %{results: [], has_more: false}
    else
      rows =
        from(m in Message,
          join: c in Guilda.Channels.Channel,
          on: c.id == m.channel_id,
          join: a in assoc(m, :author),
          where:
            c.server_id == ^server_id and c.type == "text" and m.deleted == false and
              m.kind == "user",
          order_by: [desc: m.inserted_at, desc: m.id],
          limit: ^(limit + 1),
          select: {m, c.name},
          preload: [:attachments, author: a]
        )
        |> filter_search_text(text)
        |> filter_search_author(from_name)
        |> filter_search_has(has)
        |> filter_search_pinned(pinned?)
        |> filter_search_channel(opts[:channel_id])
        |> filter_search_before(opts[:before_id])
        |> Repo.all()

      %{results: Enum.take(rows, limit), has_more: length(rows) > limit}
    end
  end

  defp normalize_search_text(value) when is_binary(value) do
    case value |> String.trim() |> String.slice(0, @search_max_text) do
      "" -> nil
      text -> text
    end
  end

  defp normalize_search_text(_), do: nil

  # Escapes LIKE wildcards so user input is always matched literally.
  defp like_pattern(text) do
    escaped = String.replace(text, ["\\", "%", "_"], fn char -> "\\" <> char end)
    "%" <> escaped <> "%"
  end

  defp filter_search_text(query, nil), do: query

  defp filter_search_text(query, text),
    do: from([m] in query, where: ilike(m.content, ^like_pattern(text)))

  defp filter_search_author(query, nil), do: query

  defp filter_search_author(query, name),
    do: from([_m, _c, a] in query, where: ilike(a.display_name, ^like_pattern(name)))

  defp filter_search_has(query, "link"),
    do: from([m] in query, where: fragment("? ~* ?", m.content, ^@link_regex))

  defp filter_search_has(query, "attachment"),
    do:
      from([m] in query,
        where: m.id in subquery(from(att in Attachment, select: att.message_id))
      )

  defp filter_search_has(query, "image") do
    images =
      from(att in Attachment, where: like(att.content_type, "image/%"), select: att.message_id)

    from([m] in query, where: m.id in subquery(images))
  end

  defp filter_search_has(query, _), do: query

  defp filter_search_pinned(query, true), do: from([m] in query, where: m.pinned == true)
  defp filter_search_pinned(query, _), do: query

  defp filter_search_channel(query, channel_id) when is_binary(channel_id) do
    case Ecto.UUID.cast(channel_id) do
      {:ok, id} -> from([m] in query, where: m.channel_id == ^id)
      :error -> from([m] in query, where: false)
    end
  end

  defp filter_search_channel(query, _), do: query

  defp filter_search_before(query, before_id) when is_binary(before_id) do
    with {:ok, id} <- Ecto.UUID.cast(before_id),
         %Message{} = pivot <- Repo.get(Message, id) do
      from([m] in query,
        where:
          m.inserted_at < ^pivot.inserted_at or
            (m.inserted_at == ^pivot.inserted_at and m.id < ^pivot.id)
      )
    else
      _ -> query
    end
  end

  defp filter_search_before(query, _), do: query

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

  @doc "Pin a message."
  def pin_message(%Message{} = msg) do
    msg
    |> Message.pin_changeset(true)
    |> Repo.update()
  end

  @doc "Unpin a message."
  def unpin_message(%Message{} = msg) do
    msg
    |> Message.pin_changeset(false)
    |> Repo.update()
  end

  @doc "List pinned messages for a channel."
  def list_pinned_messages(channel_id) do
    from(m in Message,
      where: m.channel_id == ^channel_id and m.pinned == true and m.deleted == false,
      preload: [
        author: ^from(u in User, select: [:id, :display_name, :avatar_url]),
        reactions: [:user],
        attachments: ^from(a in Attachment, order_by: [asc: a.inserted_at])
      ],
      order_by: [desc: m.inserted_at]
    )
    |> Repo.all()
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
