defmodule Guilda.AccountsTest do
  use Guilda.DataCase, async: true

  alias Guilda.Accounts
  alias Guilda.Accounts.User

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp user_attrs(overrides) do
    %{
      email: "user_#{System.unique_integer([:positive])}@example.com",
      google_sub: "sub_#{System.unique_integer([:positive])}",
      display_name: "Test User"
    }
    |> Map.merge(overrides)
  end

  defp insert_user(overrides \\ %{}) do
    attrs = user_attrs(overrides)

    %User{}
    |> User.changeset(attrs)
    |> Repo.insert!()
  end

  # ---------------------------------------------------------------------------
  # Allowlist
  # ---------------------------------------------------------------------------

  describe "email_allowed?/1" do
    test "returns false when email is not on the list" do
      refute Accounts.email_allowed?("stranger@example.com")
    end

    test "returns true after allow_email/1" do
      Accounts.allow_email("invited@example.com")
      assert Accounts.email_allowed?("invited@example.com")
    end

    test "is case-insensitive" do
      Accounts.allow_email("Mixed@Example.COM")
      assert Accounts.email_allowed?("mixed@example.com")
    end
  end

  describe "remove_allowed_email/1" do
    test "removes the email from the list" do
      Accounts.allow_email("remove_me@example.com")
      Accounts.remove_allowed_email("remove_me@example.com")
      refute Accounts.email_allowed?("remove_me@example.com")
    end

    test "is a no-op for unknown emails" do
      assert :ok = Accounts.remove_allowed_email("ghost@example.com")
    end
  end

  describe "list_allowed_emails/0" do
    test "returns all allowed emails sorted" do
      Accounts.allow_email("zzz@example.com")
      Accounts.allow_email("aaa@example.com")
      emails = Accounts.list_allowed_emails()
      assert "aaa@example.com" in emails
      assert "zzz@example.com" in emails
      assert emails == Enum.sort(emails)
    end
  end

  # ---------------------------------------------------------------------------
  # find_or_create_user/1
  # ---------------------------------------------------------------------------

  describe "find_or_create_user/1" do
    test "returns :unauthorized for unknown email" do
      profile = user_attrs(%{google_sub: "new_sub_xyz", email: "not_allowed@example.com"})
      assert {:error, :unauthorized} = Accounts.find_or_create_user(profile)
    end

    test "creates user when email is on allowlist" do
      Accounts.allow_email("allowed@example.com")
      profile = %{google_sub: "sub_allowed", email: "allowed@example.com", display_name: "Alice"}
      assert {:ok, %User{email: "allowed@example.com"}} = Accounts.find_or_create_user(profile)
    end

    test "updates profile for existing user (same google_sub)" do
      user = insert_user(%{email: "existing@example.com"})

      profile = %{
        google_sub: user.google_sub,
        email: user.email,
        display_name: "New Name",
        avatar_url: "https://example.com/avatar.jpg"
      }

      assert {:ok, updated} = Accounts.find_or_create_user(profile)
      assert updated.display_name == "New Name"
      assert updated.avatar_url == "https://example.com/avatar.jpg"
    end

    test "normalises email to lowercase" do
      Accounts.allow_email("Alice@Example.COM")
      profile = %{google_sub: "sub_case", email: "Alice@Example.COM", display_name: "Alice"}
      assert {:ok, user} = Accounts.find_or_create_user(profile)
      assert user.email == "alice@example.com"
    end
  end

  # ---------------------------------------------------------------------------
  # Sessions
  # ---------------------------------------------------------------------------

  describe "create_session/2" do
    test "returns a raw token and persisted session" do
      user = insert_user()
      assert {:ok, {raw_token, session}} = Accounts.create_session(user)
      assert is_binary(raw_token)
      assert session.user_id == user.id
      assert DateTime.compare(session.expires_at, DateTime.utc_now()) == :gt
    end

    test "stores a hash, not the raw token" do
      user = insert_user()
      {:ok, {raw_token, session}} = Accounts.create_session(user)
      refute session.token_hash == raw_token
    end
  end

  describe "get_user_by_session_token/1" do
    test "returns user for valid token" do
      user = insert_user()
      {:ok, {raw_token, _}} = Accounts.create_session(user)
      assert {:ok, loaded} = Accounts.get_user_by_session_token(raw_token)
      assert loaded.id == user.id
    end

    test "returns :invalid for unknown token" do
      assert {:error, :invalid} = Accounts.get_user_by_session_token("fake_token")
    end

    test "returns :invalid for expired session" do
      user = insert_user()
      # max_age of -1 second = already expired
      {:ok, {raw_token, _}} = Accounts.create_session(user, max_age: -1)
      assert {:error, :invalid} = Accounts.get_user_by_session_token(raw_token)
    end
  end

  describe "delete_session/1" do
    test "invalidates the token" do
      user = insert_user()
      {:ok, {raw_token, _}} = Accounts.create_session(user)
      Accounts.delete_session(raw_token)
      assert {:error, :invalid} = Accounts.get_user_by_session_token(raw_token)
    end

    test "is a no-op for unknown tokens" do
      assert :ok = Accounts.delete_session("unknown_token_xyz")
    end
  end

  describe "purge_expired_sessions/0" do
    test "removes only expired sessions" do
      user = insert_user()
      {:ok, {live_token, _}} = Accounts.create_session(user, max_age: 3600)
      {:ok, {dead_token, _}} = Accounts.create_session(user, max_age: -1)

      count = Accounts.purge_expired_sessions()
      assert count >= 1

      assert {:ok, _} = Accounts.get_user_by_session_token(live_token)
      assert {:error, :invalid} = Accounts.get_user_by_session_token(dead_token)
    end
  end

  # ---------------------------------------------------------------------------
  # Admin operations
  # ---------------------------------------------------------------------------

  describe "promote_to_admin/1" do
    test "sets role to admin" do
      user = insert_user()
      assert {:ok, updated} = Accounts.promote_to_admin(user)
      assert updated.role == "admin"
    end
  end

  describe "revoke_access/1" do
    test "deletes all sessions for the user" do
      user = insert_user()
      {:ok, {token, _}} = Accounts.create_session(user)
      Accounts.revoke_access(user)
      assert {:error, :invalid} = Accounts.get_user_by_session_token(token)
    end
  end
end
