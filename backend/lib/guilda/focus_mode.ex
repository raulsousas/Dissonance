defmodule Guilda.FocusMode do
  @moduledoc """
  Focus mode: silence a server channel and get a short summary when it is
  opened again.

  A muted channel no longer sends `new_server_message` to the user (no unread
  badge, sound or desktop notification). Friend nudges are a separate event
  (`nudge_received`) and are intentionally not affected.

  The summary covers messages written by other people since the later of
  `muted_at` and the user's last read position.
  """

  import Ecto.Query, warn: false

  alias Guilda.{ChatAccess, Repo}
  alias Guilda.Accounts.User
  alias Guilda.FocusMode.ChannelMute
  alias Guilda.Messaging.{Message, ReadState}

  @max_scanned 500
  @max_authors 5
  @max_links 5
  @max_mentions 5
  @preview_length 120
  @url_regex ~r{https?://[^\s<>"'\)\]]+}i

  # ---------------------------------------------------------------------------
  # Mute / unmute
  # ---------------------------------------------------------------------------

  @doc "Silences a channel for the user. Idempotent."
  def mute(%User{} = user, channel_id) do
    if ChatAccess.can_access?(user, "channel", channel_id) do
      now = DateTime.utc_now() |> DateTime.truncate(:second)

      Repo.insert(
        %ChannelMute{user_id: user.id, channel_id: channel_id, muted_at: now},
        on_conflict: :nothing,
        conflict_target: [:user_id, :channel_id]
      )

      {:ok, muted_at(user.id, channel_id)}
    else
      {:error, :not_found}
    end
  end

  @doc "Re-enables a channel. Idempotent."
  def unmute(%User{id: user_id}, channel_id) do
    if ChatAccess.valid_uuid?(channel_id) do
      Repo.delete_all(
        from m in ChannelMute, where: m.user_id == ^user_id and m.channel_id == ^channel_id
      )
    end

    :ok
  end

  @doc "Channels the user has silenced: `[%{channel_id, muted_at}]`."
  def list_muted(%User{id: user_id}) do
    Repo.all(
      from m in ChannelMute,
        where: m.user_id == ^user_id,
        order_by: [asc: m.muted_at],
        select: %{channel_id: m.channel_id, muted_at: m.muted_at}
    )
  end

  @doc "Removes from `user_ids` everyone who silenced `channel_id`."
  def reject_muted([], _channel_id), do: []

  def reject_muted(user_ids, channel_id) do
    muted =
      Repo.all(
        from m in ChannelMute,
          where: m.channel_id == ^channel_id and m.user_id in ^user_ids,
          select: m.user_id
      )

    user_ids -- muted
  end

  defp muted_at(user_id, channel_id) do
    Repo.one(
      from m in ChannelMute,
        where: m.user_id == ^user_id and m.channel_id == ^channel_id,
        select: m.muted_at
    )
  end

  # ---------------------------------------------------------------------------
  # Summary
  # ---------------------------------------------------------------------------

  @doc """
  Summary of what the user missed in a silenced channel.

  Returns `{:ok, summary}` or `{:error, :not_found}` when the user cannot see
  the channel or has not silenced it.
  """
  def summary(%User{} = user, channel_id) do
    with true <- ChatAccess.can_access?(user, "channel", channel_id),
         since when not is_nil(since) <- summary_start(user.id, channel_id) do
      {:ok, build_summary(user, channel_id, since)}
    else
      _ -> {:error, :not_found}
    end
  end

  defp summary_start(user_id, channel_id) do
    muted_at = muted_at(user_id, channel_id)

    last_read_at =
      Repo.one(
        from r in ReadState,
          where: r.user_id == ^user_id and r.channel_id == ^channel_id,
          select: r.last_read_at
      )

    case {muted_at, last_read_at} do
      {nil, _} -> nil
      {muted, nil} -> muted
      {muted, read} -> if DateTime.compare(read, muted) == :gt, do: read, else: muted
    end
  end

  defp build_summary(user, channel_id, since) do
    user_id = user.id

    rows =
      Repo.all(
        from m in Message,
          join: a in assoc(m, :author),
          where:
            m.channel_id == ^channel_id and m.deleted == false and m.kind == "user" and
              m.author_id != ^user_id and m.inserted_at > ^since,
          order_by: [asc: m.inserted_at, asc: m.id],
          limit: ^(@max_scanned + 1),
          select: %{
            id: m.id,
            content: m.content,
            author_id: m.author_id,
            author_name: a.display_name,
            inserted_at: m.inserted_at
          }
      )

    truncated = length(rows) > @max_scanned
    messages = Enum.take(rows, @max_scanned)
    mention_regex = user_mention_regex(user.display_name)

    %{
      since: since,
      total: length(messages),
      truncated: truncated,
      authors: top_authors(messages),
      links: links(messages),
      mentions: mentions(messages, mention_regex)
    }
  end

  defp top_authors(messages) do
    messages
    |> Enum.group_by(& &1.author_id)
    |> Enum.map(fn {author_id, list} ->
      %{authorId: author_id, authorName: hd(list).author_name, count: length(list)}
    end)
    |> Enum.sort_by(&{-&1.count, &1.authorName || ""})
    |> Enum.take(@max_authors)
  end

  defp links(messages) do
    messages
    |> Enum.flat_map(fn m ->
      @url_regex
      |> Regex.scan(m.content || "")
      |> Enum.map(fn [url] -> %{url: clean_url(url), authorName: m.author_name, messageId: m.id} end)
    end)
    |> Enum.uniq_by(& &1.url)
    |> Enum.take(@max_links)
  end

  defp clean_url(url), do: url |> String.trim_trailing(".") |> String.trim_trailing(",") |> String.slice(0, 300)

  defp mentions(messages, mention_regex) do
    messages
    |> Enum.flat_map(fn m ->
      content = m.content || ""

      cond do
        mention_regex && Regex.match?(mention_regex, content) -> [mention(m, "user")]
        Regex.match?(~r/(?<![\w])@(everyone|here)(?![\w])/iu, content) -> [mention(m, "everyone")]
        true -> []
      end
    end)
    |> Enum.take(-@max_mentions)
  end

  defp mention(m, kind) do
    %{
      messageId: m.id,
      authorName: m.author_name,
      kind: kind,
      preview: String.slice(m.content || "", 0, @preview_length)
    }
  end

  defp user_mention_regex(name) when is_binary(name) and name != "" do
    Regex.compile!("(?<![\\w])@" <> Regex.escape(name) <> "(?![\\w])", "iu")
  end

  defp user_mention_regex(_), do: nil
end
