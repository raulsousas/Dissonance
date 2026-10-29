defmodule GuildaWeb.RemindersController do
  @moduledoc """
  REST API for message reminders.

    GET    /api/reminders        — pending reminders (including fired-but-unacknowledged)
    POST   /api/reminders        — create (scope, message_id, remind_at)
    DELETE /api/reminders/:id    — cancel / acknowledge
  """

  use GuildaWeb, :controller

  alias Guilda.Reminders

  def index(conn, _params) do
    reminders = conn.assigns.current_user |> Reminders.list_pending() |> Enum.map(&Reminders.serialize/1)
    json(conn, %{reminders: reminders})
  end

  def create(conn, params) do
    case Reminders.create_reminder(conn.assigns.current_user, params) do
      {:ok, reminder} ->
        conn |> put_status(201) |> json(%{reminder: Reminders.serialize(reminder)})

      {:error, :invalid_time} ->
        error(conn, 422, "invalid reminder time")

      {:error, :too_many} ->
        error(conn, 429, "too many pending reminders")

      {:error, :forbidden} ->
        error(conn, 403, "forbidden")

      {:error, :not_found} ->
        error(conn, 404, "message not found")

      {:error, %Ecto.Changeset{}} ->
        error(conn, 422, "invalid reminder")
    end
  end

  def delete(conn, %{"id" => id}) do
    case Reminders.delete_reminder(conn.assigns.current_user, id) do
      {:ok, _} -> send_resp(conn, 204, "")
      {:error, _} -> error(conn, 404, "reminder not found")
    end
  end

  defp error(conn, status, message), do: conn |> put_status(status) |> json(%{error: message})
end
