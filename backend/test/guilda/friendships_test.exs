defmodule Guilda.FriendshipsTest do
  use Guilda.DataCase, async: true

  alias Guilda.Accounts.User
  alias Guilda.Friendships

  defp insert_user(overrides \\ %{}) do
    attrs =
      %{
        email: "user_#{System.unique_integer([:positive])}@example.com",
        google_sub: "sub_#{System.unique_integer([:positive])}",
        display_name: "User #{System.unique_integer([:positive])}"
      }
      |> Map.merge(overrides)

    %User{}
    |> User.changeset(attrs)
    |> Repo.insert!()
  end

  describe "send_request/2" do
    test "creates a pending friendship between two users" do
      u1 = insert_user()
      u2 = insert_user()

      assert {:ok, f} = Friendships.send_request(u1, u2.id)
      assert f.status == "pending"
      assert f.requester_id == u1.id
      assert f.addressee_id == u2.id
    end

    test "can send request by email" do
      u1 = insert_user()
      u2 = insert_user(%{email: "target@example.com"})

      assert {:ok, f} = Friendships.send_request(u1, "target@example.com")
      assert f.status == "pending"
      assert f.addressee_id == u2.id
    end

    test "cannot friend self" do
      u1 = insert_user()
      assert {:error, :cannot_friend_self} = Friendships.send_request(u1, u1.id)
    end

    test "returns error for unknown user" do
      u1 = insert_user()
      assert {:error, :user_not_found} = Friendships.send_request(u1, "unknown@example.com")
    end

    test "returns already_sent if request already pending" do
      u1 = insert_user()
      u2 = insert_user()

      {:ok, _} = Friendships.send_request(u1, u2.id)
      assert {:error, :already_sent} = Friendships.send_request(u1, u2.id)
    end

    test "automatically accepts if opposite request was already pending" do
      u1 = insert_user()
      u2 = insert_user()

      {:ok, _} = Friendships.send_request(u1, u2.id)
      # u2 sends request to u1 -> should auto accept
      assert {:ok, accepted} = Friendships.send_request(u2, u1.id)
      assert accepted.status == "accepted"
      assert Friendships.friends?(u1.id, u2.id)
    end
  end

  describe "accept_request/2" do
    test "addressee can accept a pending request" do
      u1 = insert_user()
      u2 = insert_user()

      {:ok, f} = Friendships.send_request(u1, u2.id)
      assert {:ok, accepted} = Friendships.accept_request(u2, f.id)
      assert accepted.status == "accepted"
      assert Friendships.friends?(u1.id, u2.id)
    end

    test "requester cannot accept their own request" do
      u1 = insert_user()
      u2 = insert_user()

      {:ok, f} = Friendships.send_request(u1, u2.id)
      assert {:error, :forbidden} = Friendships.accept_request(u1, f.id)
    end
  end

  describe "decline_request/2" do
    test "addressee can decline a pending request" do
      u1 = insert_user()
      u2 = insert_user()

      {:ok, f} = Friendships.send_request(u1, u2.id)
      assert {:ok, _} = Friendships.decline_request(u2, f.id)
      refute Friendships.friends?(u1.id, u2.id)
    end

    test "requester can cancel a pending request" do
      u1 = insert_user()
      u2 = insert_user()

      {:ok, f} = Friendships.send_request(u1, u2.id)
      assert {:ok, _} = Friendships.decline_request(u1, f.id)
      refute Friendships.friends?(u1.id, u2.id)
    end
  end

  describe "remove_friend/2" do
    test "removes an accepted friendship" do
      u1 = insert_user()
      u2 = insert_user()

      {:ok, f} = Friendships.send_request(u1, u2.id)
      {:ok, _} = Friendships.accept_request(u2, f.id)
      assert Friendships.friends?(u1.id, u2.id)

      assert {:ok, _} = Friendships.remove_friend(u1, u2.id)
      refute Friendships.friends?(u1.id, u2.id)
    end
  end

  describe "list_friends/1 and list_pending_requests/1" do
    test "returns accepted friends and pending requests correctly" do
      u1 = insert_user(%{display_name: "Alice"})
      u2 = insert_user(%{display_name: "Bob"})
      u3 = insert_user(%{display_name: "Charlie"})

      {:ok, f1} = Friendships.send_request(u1, u2.id)
      {:ok, _} = Friendships.accept_request(u2, f1.id)

      {:ok, _} = Friendships.send_request(u3, u1.id)

      friends = Friendships.list_friends(u1)
      assert length(friends) == 1
      assert hd(friends).displayName == "Bob"

      pending = Friendships.list_pending_requests(u1)
      assert length(pending.incoming) == 1
      assert hd(pending.incoming).user.displayName == "Charlie"
      assert Enum.empty?(pending.outgoing)
    end
  end
end
