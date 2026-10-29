defmodule GuildaWeb.FriendsController do
  @moduledoc """
  API endpoints for friendship management (friends list, friend requests, accept/decline).
  """

  use GuildaWeb, :controller
  alias Guilda.Friendships

  # GET /api/friends
  def index(conn, _params) do
    user = conn.assigns.current_user
    friends = Friendships.list_friends(user)
    json(conn, %{data: friends})
  end

  # GET /api/friends/requests
  def list_requests(conn, _params) do
    user = conn.assigns.current_user
    requests = Friendships.list_pending_requests(user)
    json(conn, %{data: requests})
  end

  # POST /api/friends/requests
  def create_request(conn, params) do
    user = conn.assigns.current_user
    target = params["target"] || params["email"] || params["user_id"] || params["userId"]

    if is_nil(target) or String.trim(target) == "" do
      conn |> put_status(:bad_request) |> json(%{error: "Target user or email is required"})
    else
      case Friendships.send_request(user, String.trim(target)) do
        {:ok, %Friendships.Friendship{} = friendship} ->
          # Broadcast real-time notifications to both users
          GuildaWeb.Endpoint.broadcast("user:#{friendship.addressee_id}", "friend_request_received", %{
            id: friendship.id,
            requesterId: friendship.requester_id,
            status: friendship.status
          })
          GuildaWeb.Endpoint.broadcast("user:#{friendship.requester_id}", "friend_request_sent", %{
            id: friendship.id,
            addresseeId: friendship.addressee_id,
            status: friendship.status
          })

          conn
          |> put_status(:created)
          |> json(%{
            data: %{
              id: friendship.id,
              status: friendship.status,
              requesterId: friendship.requester_id,
              addresseeId: friendship.addressee_id
            }
          })

        {:error, :user_not_found} ->
          conn |> put_status(:not_found) |> json(%{error: "User not found"})

        {:error, :cannot_friend_self} ->
          conn |> put_status(:unprocessable_entity) |> json(%{error: "You cannot friend yourself"})

        {:error, :already_friends} ->
          conn |> put_status(:conflict) |> json(%{error: "You are already friends with this user"})

        {:error, :already_sent} ->
          conn |> put_status(:conflict) |> json(%{error: "Friend request already sent"})

        {:error, :blocked} ->
          conn |> put_status(:forbidden) |> json(%{error: "Unable to send friend request"})

        {:error, cs} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
      end
    end
  end

  # POST /api/friends/requests/:id/accept
  def accept_request(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case Friendships.accept_request(user, id) do
      {:ok, friendship} ->
        # Broadcast real-time notification to both users
        GuildaWeb.Endpoint.broadcast("user:#{friendship.requester_id}", "friend_request_accepted", %{
          id: friendship.id,
          friendId: friendship.addressee_id
        })
        GuildaWeb.Endpoint.broadcast("user:#{friendship.addressee_id}", "friend_request_accepted", %{
          id: friendship.id,
          friendId: friendship.requester_id
        })

        json(conn, %{data: %{id: friendship.id, status: friendship.status}})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Friend request not found"})

      {:error, :already_friends} ->
        conn |> put_status(:conflict) |> json(%{error: "Already friends"})

      {:error, :forbidden} ->
        conn |> put_status(:forbidden) |> json(%{error: "Cannot accept this request"})
    end
  end

  # DELETE /api/friends/requests/:id
  def decline_request(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case Friendships.decline_request(user, id) do
      {:ok, friendship} ->
        GuildaWeb.Endpoint.broadcast("user:#{friendship.requester_id}", "friend_request_declined", %{id: friendship.id})
        GuildaWeb.Endpoint.broadcast("user:#{friendship.addressee_id}", "friend_request_declined", %{id: friendship.id})

        send_resp(conn, :no_content, "")

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Request not found"})

      {:error, :forbidden} ->
        conn |> put_status(:forbidden) |> json(%{error: "Cannot decline this request"})
    end
  end

  # Minimum seconds between nudges from the same sender to the same friend.
  @nudge_cooldown_seconds 300

  # POST /api/friends/:id/nudge  (:id is the friend's user id)
  def nudge(conn, %{"id" => target_id}) do
    user = conn.assigns.current_user
    target = Guilda.Accounts.get_user(target_id)

    cond do
      is_nil(target) or target.id == user.id or not Friendships.friends?(user.id, target.id) ->
        conn |> put_status(:forbidden) |> json(%{error: "Only friends can be nudged"})

      not target.allow_nudges ->
        conn |> put_status(:forbidden) |> json(%{error: "nudges_disabled"})

      true ->
        key = "nudge:#{user.id}:#{target.id}"

        case Redix.command(:redix, ["SET", key, "1", "NX", "EX", Integer.to_string(@nudge_cooldown_seconds)]) do
          {:ok, nil} ->
            retry_after =
              case Redix.command(:redix, ["TTL", key]) do
                {:ok, ttl} when is_integer(ttl) and ttl > 0 -> ttl
                _ -> @nudge_cooldown_seconds
              end

            conn |> put_status(:too_many_requests) |> json(%{error: "cooldown", retryAfter: retry_after})

          _ ->
            # "Do not disturb" users are never interrupted, but the sender is not told.
            unless target.status == "dnd" do
              GuildaWeb.Endpoint.broadcast("user:#{target.id}", "nudge_received", %{
                fromId: user.id,
                fromName: user.display_name,
                fromAvatar: user.avatar_url
              })
            end

            send_resp(conn, :no_content, "")
        end
    end
  end

  # DELETE /api/friends/:id
  def delete(conn, %{"id" => id}) do
    user = conn.assigns.current_user

    case Friendships.remove_friend(user, id) do
      {:ok, friendship} ->
        GuildaWeb.Endpoint.broadcast("user:#{friendship.requester_id}", "friend_removed", %{id: friendship.id})
        GuildaWeb.Endpoint.broadcast("user:#{friendship.addressee_id}", "friend_removed", %{id: friendship.id})

        send_resp(conn, :no_content, "")

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "Friendship not found"})

      {:error, :forbidden} ->
        conn |> put_status(:forbidden) |> json(%{error: "Not allowed"})
    end
  end

  defp format_errors(cs) do
    Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
  end
end
