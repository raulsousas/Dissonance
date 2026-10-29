defmodule Guilda.Reminders do
  @moduledoc """
  Message reminders ("lembre-me em 1h / amanhã").

  A reminder snapshots a short preview of the message. When it comes due the
  `Guilda.Reminders.Worker` marks it as notified and pushes `reminder_due` on
  the user's personal channel. The row is deleted once the client acknowledges
  it, so reminders that fired while the user was offline are shown on the next
  app load (see `list_pending/1`).
  """

  import Ecto.Query, warn: false

  alias Guilda.{ChatAccess, DirectMessaging, Messaging, Repo}
  alias Guilda.Accounts.User
  alias Guilda.Reminders.Reminder

  @max_pending_per_user 50
  @max_horizon_seconds 60 * 60 * 24 * 365
  @min_lead_seconds 30
  @preview_length 140

  # ---------------------------------------------------------------------------
  # Create / list / delete
  # ---------------------------------------------------------------------------

  @doc """
  Creates a reminder for a message the user can see.

  `attrs`: "scope" ("channel" | "dm"), "message_id", "remind_at" (ISO 8601).
  """
  def create_reminder(%User{} = user, attrs, now \\ DateTime.utc_now()) do
    scope = attrs["scope"]
    message_id = attrs["message_id"]

    with {:ok, remind_at} <- parse_remind_at(attrs["remind_at"], now),
         {:ok, snapshot} <- load_message_snapshot(user, scope, message_id),
         :ok <- check_quota(user) do
      %Reminder{}
      |> Reminder.changeset(
        Map.merge(snapshot, %{
          user_id: user.id,
          scope: scope,
          message_id: message_id,
          remind_at: remind_at
        })
      )
      |> Repo.insert()
    end
  end

  defp parse_remind_at(value, now) when is_binary(value) do
    case DateTime.from_iso8601(value) do
      {:ok, datetime, _offset} ->
        datetime = DateTime.truncate(datetime, :second)
        diff = DateTime.diff(datetime, now, :second)

        if diff < @min_lead_seconds or diff > @max_horizon_seconds,
          do: {:error, :invalid_time},
          else: {:ok, datetime}

      _ ->
        {:error, :invalid_time}
    end
  end

  defp parse_remind_at(_, _now), do: {:error, :invalid_time}

  defp load_message_snapshot(user, scope, message_id) do
    if ChatAccess.valid_uuid?(message_id) do
      do_load_snapshot(user, scope, message_id)
    else
      {:error, :not_found}
    end
  end

  defp do_load_snapshot(user, "channel", message_id) do
    case Messaging.get_message_with_author(message_id) do
      nil ->
        {:error, :not_found}

      %{deleted: true} ->
        {:error, :not_found}

      message ->
        if ChatAccess.can_access?(user, "channel", message.channel_id) do
          {:ok,
           %{
             channel_id: message.channel_id,
             server_id: server_id_of(message.channel_id),
             author_name: message.author && message.author.display_name,
             preview: preview(message.content)
           }}
        else
          {:error, :forbidden}
        end
    end
  end

  defp do_load_snapshot(user, "dm", message_id) do
    case DirectMessaging.get_message(message_id) do
      nil ->
        {:error, :not_found}

      %{deleted: true} ->
        {:error, :not_found}

      message ->
        if DirectMessaging.member?(message.conversation_id, user.id) do
          {:ok,
           %{
             channel_id: message.conversation_id,
             server_id: nil,
             author_name: message.author && message.author.display_name,
             preview: preview(message.content)
           }}
        else
          {:error, :forbidden}
        end
    end
  end

  defp do_load_snapshot(_user, _scope, _message_id), do: {:error, :not_found}

  defp server_id_of(channel_id) do
    case Guilda.Channels.get_channel(channel_id) do
      nil -> nil
      channel -> channel.server_id
    end
  end

  defp preview(nil), do: "(anexo)"

  defp preview(content) do
    content = content |> String.replace(~r/\s+/, " ") |> String.trim()
    if content == "", do: "(anexo)", else: String.slice(content, 0, @preview_length)
  end

  defp check_quota(%User{id: user_id}) do
    count = Repo.aggregate(from(r in Reminder, where: r.user_id == ^user_id), :count)
    if count >= @max_pending_per_user, do: {:error, :too_many}, else: :ok
  end

  @doc "Reminders still waiting to be shown (due in the future or fired but unacknowledged)."
  def list_pending(%User{id: user_id}) do
    Repo.all(from r in Reminder, where: r.user_id == ^user_id, order_by: [asc: r.remind_at])
  end

  @doc "Deletes (cancels or acknowledges) one of the user's reminders."
  def delete_reminder(%User{id: user_id}, reminder_id) do
    with true <- ChatAccess.valid_uuid?(reminder_id),
         %Reminder{} = reminder <- Repo.get_by(Reminder, id: reminder_id, user_id: user_id) do
      Repo.delete(reminder)
    else
      _ -> {:error, :not_found}
    end
  end

  # ---------------------------------------------------------------------------
  # Due reminders (used by the worker)
  # ---------------------------------------------------------------------------

  @doc """
  Marks every due, not-yet-notified reminder as notified and returns them.

  Single `UPDATE ... RETURNING`, so concurrent callers never notify twice.
  """
  def claim_due(now \\ DateTime.utc_now()) do
    now = DateTime.truncate(now, :second)

    {_count, reminders} =
      Repo.update_all(
        from(r in Reminder,
          where: is_nil(r.notified_at) and r.remind_at <= ^now,
          select: r
        ),
        set: [notified_at: now]
      )

    reminders
  end

  @doc "Payload sent to the client (REST and realtime)."
  def serialize(%Reminder{} = r) do
    %{
      id: r.id,
      scope: r.scope,
      serverId: r.server_id,
      channelId: r.channel_id,
      messageId: r.message_id,
      authorName: r.author_name,
      preview: r.preview,
      remindAt: r.remind_at,
      due: not is_nil(r.notified_at)
    }
  end

  @doc "Pushes a due reminder to the user's personal channel."
  def notify(%Reminder{} = reminder) do
    GuildaWeb.Endpoint.broadcast("user:#{reminder.user_id}", "reminder_due", serialize(reminder))
  end
end
