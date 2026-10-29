defmodule GuildaWeb.PollsController do
  @moduledoc """
  REST API for interactive polls.

    GET    /api/channels/:channel_id/polls — polls of a channel (newest first)
    POST   /api/polls                   — create
    GET    /api/polls/:id               — fetch
    POST   /api/polls/:id/votes         — toggle vote  (option_id)
    POST   /api/polls/:id/options       — suggest option (text)
    POST   /api/polls/:id/comments      — comment (text)
    PATCH  /api/polls/:id               — close / reopen (closed)
    DELETE /api/polls/:id               — delete (author only)

  Every change is broadcast on the chat topic as `poll_updated` / `poll_deleted`
  so all participants see votes in realtime.
  """

  use GuildaWeb, :controller

  alias Guilda.Polls

  def index(conn, %{"channel_id" => channel_id}) do
    case Polls.list_for_channel(conn.assigns.current_user, channel_id) do
      {:ok, polls} -> json(conn, %{polls: Enum.map(polls, &Polls.serialize/1)})
      {:error, reason} -> respond_error(conn, reason)
    end
  end

  def create(conn, params) do
    user = conn.assigns.current_user

    case Polls.create_poll(user, params) do
      {:ok, poll} -> respond_updated(conn, poll, 201)
      {:error, reason} -> respond_error(conn, reason)
    end
  end

  def show(conn, %{"id" => id}) do
    case Polls.get_poll_for_user(conn.assigns.current_user, id) do
      {:ok, poll} -> json(conn, %{poll: Polls.serialize(poll)})
      {:error, reason} -> respond_error(conn, reason)
    end
  end

  def vote(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    with {:ok, poll} <- Polls.get_poll_for_user(user, id),
         {:ok, updated} <- Polls.toggle_vote(user, poll, params["option_id"]) do
      respond_updated(conn, updated, 200)
    else
      {:error, reason} -> respond_error(conn, reason)
    end
  end

  def suggest_option(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    with {:ok, poll} <- Polls.get_poll_for_user(user, id),
         {:ok, updated} <- Polls.suggest_option(user, poll, params["text"]) do
      respond_updated(conn, updated, 201)
    else
      {:error, reason} -> respond_error(conn, reason)
    end
  end

  def comment(conn, %{"id" => id} = params) do
    user = conn.assigns.current_user

    with {:ok, poll} <- Polls.get_poll_for_user(user, id),
         {:ok, updated} <- Polls.add_comment(user, poll, params["text"]) do
      respond_updated(conn, updated, 201)
    else
      {:error, reason} -> respond_error(conn, reason)
    end
  end

  def update(conn, %{"id" => id, "closed" => closed}) when is_boolean(closed) do
    user = conn.assigns.current_user

    with {:ok, poll} <- Polls.get_poll_for_user(user, id),
         {:ok, updated} <- Polls.set_closed(user, poll, closed) do
      respond_updated(conn, updated, 200)
    else
      {:error, reason} -> respond_error(conn, reason)
    end
  end

  def update(conn, _params), do: respond_error(conn, :invalid)

  def delete(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    with {:ok, poll} <- Polls.get_poll_for_user(user, id),
         {:ok, _} <- Polls.delete_poll(user, poll) do
      GuildaWeb.Endpoint.broadcast(Polls.topic(poll), "poll_deleted", %{id: poll.id})
      send_resp(conn, 204, "")
    else
      {:error, reason} -> respond_error(conn, reason)
    end
  end

  # ---------------------------------------------------------------------------

  defp respond_updated(conn, poll, status) do
    payload = Polls.serialize(poll)
    GuildaWeb.Endpoint.broadcast(Polls.topic(poll), "poll_updated", payload)
    conn |> put_status(status) |> json(%{poll: payload})
  end

  defp respond_error(conn, :not_found), do: error(conn, 404, "poll not found")
  defp respond_error(conn, :forbidden), do: error(conn, 403, "forbidden")
  defp respond_error(conn, :closed), do: error(conn, 409, "poll is closed")
  defp respond_error(conn, :duplicate), do: error(conn, 409, "option already exists")
  defp respond_error(conn, :suggestions_disabled), do: error(conn, 403, "suggestions are disabled")
  defp respond_error(conn, :comments_disabled), do: error(conn, 403, "comments are disabled")
  defp respond_error(conn, :invalid_options), do: error(conn, 422, "invalid number of options")
  defp respond_error(conn, :invalid), do: error(conn, 422, "invalid request")

  defp respond_error(conn, %Ecto.Changeset{} = changeset) do
    errors = Ecto.Changeset.traverse_errors(changeset, fn {msg, _} -> msg end)
    conn |> put_status(422) |> json(%{errors: errors})
  end

  defp error(conn, status, message), do: conn |> put_status(status) |> json(%{error: message})
end
