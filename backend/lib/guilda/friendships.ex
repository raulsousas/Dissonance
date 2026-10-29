defmodule Guilda.Friendships do
  @moduledoc """
  The Friendships context.

  Handles friend requests, acceptance, removals, and status queries.
  """

  import Ecto.Query, warn: false
  alias Guilda.Repo
  alias Guilda.Accounts.User
  alias Guilda.Friendships.Friendship

  # ---------------------------------------------------------------------------
  # Queries
  # ---------------------------------------------------------------------------

  @doc """
  Lists all accepted friends for the given user, returning a list of User structs.
  """
  def list_friends(%User{id: user_id}) do
    # Friends where user was requester
    requester_friends =
      Repo.all(
        from f in Friendship,
          where: f.requester_id == ^user_id and f.status == "accepted",
          join: u in User,
          on: u.id == f.addressee_id,
          select: %{
            id: u.id,
            email: u.email,
            displayName: u.display_name,
            avatarUrl: u.avatar_url,
            status: u.status,
            allowNudges: u.allow_nudges,
            friendshipId: f.id,
            since: f.updated_at
          }
      )

    # Friends where user was addressee
    addressee_friends =
      Repo.all(
        from f in Friendship,
          where: f.addressee_id == ^user_id and f.status == "accepted",
          join: u in User,
          on: u.id == f.requester_id,
          select: %{
            id: u.id,
            email: u.email,
            displayName: u.display_name,
            avatarUrl: u.avatar_url,
            status: u.status,
            allowNudges: u.allow_nudges,
            friendshipId: f.id,
            since: f.updated_at
          }
      )

    Enum.sort_by(requester_friends ++ addressee_friends, & &1.displayName)
  end

  @doc """
  Lists pending friend requests for the given user.
  Returns `%{incoming: [...], outgoing: [...]}`.
  """
  def list_pending_requests(%User{id: user_id}) do
    incoming =
      Repo.all(
        from f in Friendship,
          where: f.addressee_id == ^user_id and f.status == "pending",
          join: u in User,
          on: u.id == f.requester_id,
          select: %{
            id: f.id,
            status: f.status,
            insertedAt: f.inserted_at,
            user: %{
              id: u.id,
              email: u.email,
              displayName: u.display_name,
              avatarUrl: u.avatar_url,
              status: u.status
            }
          }
      )

    outgoing =
      Repo.all(
        from f in Friendship,
          where: f.requester_id == ^user_id and f.status == "pending",
          join: u in User,
          on: u.id == f.addressee_id,
          select: %{
            id: f.id,
            status: f.status,
            insertedAt: f.inserted_at,
            user: %{
              id: u.id,
              email: u.email,
              displayName: u.display_name,
              avatarUrl: u.avatar_url,
              status: u.status
            }
          }
      )

    %{incoming: incoming, outgoing: outgoing}
  end

  @doc "Finds a friendship between two users in either direction."
  def get_friendship(user_a_id, user_b_id) do
    Repo.one(
      from f in Friendship,
        where:
          (f.requester_id == ^user_a_id and f.addressee_id == ^user_b_id) or
            (f.requester_id == ^user_b_id and f.addressee_id == ^user_a_id)
    )
  end

  @doc "Returns true if two users are accepted friends."
  def friends?(user_a_id, user_b_id) do
    Repo.exists?(
      from f in Friendship,
        where:
          ((f.requester_id == ^user_a_id and f.addressee_id == ^user_b_id) or
             (f.requester_id == ^user_b_id and f.addressee_id == ^user_a_id)) and
            f.status == "accepted"
    )
  end

  # ---------------------------------------------------------------------------
  # Mutations
  # ---------------------------------------------------------------------------

  @doc """
  Sends a friend request from `requester` to a target user (found by id or email).
  """
  def send_request(%User{} = requester, target) when is_binary(target) do
    target_user =
      if String.contains?(target, "@") do
        Repo.get_by(User, email: String.downcase(target))
      else
        Repo.get(User, target)
      end

    case target_user do
      nil ->
        {:error, :user_not_found}

      %User{id: target_id} when target_id == requester.id ->
        {:error, :cannot_friend_self}

      %User{} = addressee ->
        send_request_to_user(requester, addressee)
    end
  end

  defp send_request_to_user(%User{id: req_id}, %User{id: add_id}) do
    existing = get_friendship(req_id, add_id)

    case existing do
      nil ->
        %Friendship{}
        |> Friendship.changeset(%{
          requester_id: req_id,
          addressee_id: add_id,
          status: "pending"
        })
        |> Repo.insert()

      %Friendship{status: "accepted"} ->
        {:error, :already_friends}

      %Friendship{status: "blocked"} ->
        {:error, :blocked}

      %Friendship{status: "pending", requester_id: ^req_id} ->
        {:error, :already_sent}

      %Friendship{status: "pending", requester_id: ^add_id} = pending ->
        # The other user already sent a request — automatically accept it!
        pending
        |> Friendship.changeset(%{status: "accepted"})
        |> Repo.update()
    end
  end

  @doc """
  Accepts an incoming friend request. Only the addressee can accept.
  """
  def accept_request(%User{id: user_id}, friendship_id) do
    case Repo.get(Friendship, friendship_id) do
      nil ->
        {:error, :not_found}

      %Friendship{addressee_id: ^user_id, status: "pending"} = friendship ->
        friendship
        |> Friendship.changeset(%{status: "accepted"})
        |> Repo.update()

      %Friendship{status: "accepted"} ->
        {:error, :already_friends}

      _ ->
        {:error, :forbidden}
    end
  end

  @doc """
  Declines or cancels a friend request. Either party can decline/cancel while pending.
  """
  def decline_request(%User{id: user_id}, friendship_id) do
    case Repo.get(Friendship, friendship_id) do
      nil ->
        {:error, :not_found}

      %Friendship{requester_id: ^user_id, status: "pending"} = friendship ->
        Repo.delete(friendship)

      %Friendship{addressee_id: ^user_id, status: "pending"} = friendship ->
        Repo.delete(friendship)

      _ ->
        {:error, :forbidden}
    end
  end

  @doc """
  Removes an existing friendship (or declines/deletes request) between two users.
  """
  def remove_friend(%User{id: user_id}, target_user_or_friendship_id) do
    friendship =
      case Repo.get(Friendship, target_user_or_friendship_id) do
        %Friendship{} = f -> f
        nil -> get_friendship(user_id, target_user_or_friendship_id)
      end

    case friendship do
      nil ->
        {:error, :not_found}

      %Friendship{requester_id: req, addressee_id: add} = f
      when req == user_id or add == user_id ->
        Repo.delete(f)

      _ ->
        {:error, :forbidden}
    end
  end
end
