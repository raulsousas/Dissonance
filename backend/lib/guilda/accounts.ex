defmodule Guilda.Accounts do
  @moduledoc """
  The Accounts context.

  Handles user identity, OAuth-based authentication, session management,
  the allowlist (which emails may log in), admin promotion, and invitations.
  """

  import Ecto.Query, warn: false

  alias Guilda.Repo
  alias Guilda.Accounts.{User, Session}

  # ---------------------------------------------------------------------------
  # User lookup / upsert
  # ---------------------------------------------------------------------------

  @doc """
  Fetches a user by their Google `sub` identifier.
  Returns `nil` if not found.
  """
  def get_user_by_google_sub(sub) when is_binary(sub) do
    Repo.get_by(User, google_sub: sub)
  end

  @doc """
  Fetches a user by email (case-insensitive).
  Returns `nil` if not found.
  """
  def get_user_by_email(email) when is_binary(email) do
    Repo.get_by(User, email: String.downcase(email))
  end

  @doc """
  Fetches a user by ID. Returns `nil` if not found.
  """
  def get_user(id) when is_binary(id) do
    Repo.get(User, id)
  end

  @doc """
  Creates or updates a user from a Google OAuth profile map.

  The profile map must contain:
    - `:google_sub`    – Google's stable user identifier
    - `:email`         – verified email address from Google
    - `:display_name`  – full name from Google profile
    - `:avatar_url`    – profile picture URL (optional)

  Returns:
    - `{:ok, user}` if the user is allowed (on the allowlist or an existing user)
    - `{:error, :unauthorized}` if the email is not on the allowlist and the user
      does not already have an account
    - `{:error, changeset}` on validation failure
  """
  def find_or_create_user(%{google_sub: sub} = profile) do
    case get_user_by_google_sub(sub) do
      %User{} = existing ->
        update_user_profile(existing, profile)

      nil ->
        create_user_if_allowed(profile)
    end
  end

  defp create_user_if_allowed(%{email: email} = profile) do
    normalized = String.downcase(email)

    cond do
      # Email is the first-admin email — create with admin role
      is_first_admin_email?(normalized) ->
        create_user(Map.put(profile, :role, "admin"))

      # Email is on the allowlist
      email_allowed?(normalized) ->
        create_user(profile)

      true ->
        {:error, :unauthorized}
    end
  end

  @doc "Update user profile attributes (display_name, avatar_url, status)."
  def update_user(%User{} = user, attrs) do
    user
    |> User.update_changeset(attrs)
    |> Repo.update()
  end

  defp update_user_profile(%User{} = user, profile) do
    attrs = %{
      display_name: profile.display_name,
      avatar_url: Map.get(profile, :avatar_url)
    }

    user
    |> User.update_changeset(attrs)
    |> Repo.update()
  end

  defp create_user(profile) do
    %User{}
    |> User.changeset(%{
      email: String.downcase(profile.email),
      google_sub: profile.google_sub,
      display_name: profile.display_name,
      avatar_url: Map.get(profile, :avatar_url),
      role: Map.get(profile, :role, "member")
    })
    |> Repo.insert()
  end

  # ---------------------------------------------------------------------------
  # Allowlist
  # ---------------------------------------------------------------------------

  @doc """
  Returns `true` if the given email is on the allowed-emails list.
  This checks against the `allowed_emails` table.
  """
  def email_allowed?(email) when is_binary(email) do
    normalized = String.downcase(email)
    Repo.exists?(from ae in "allowed_emails", where: ae.email == ^normalized)
  end

  @doc """
  Adds an email to the allowlist. Idempotent — does not fail if already present.

  Accepts an optional `added_by` user ID for audit purposes.
  """
  def allow_email(email, added_by \\ nil) when is_binary(email) do
    normalized = String.downcase(email)

    row =
      %{email: normalized, inserted_at: utc_now()}
      |> then(fn r -> if added_by, do: Map.put(r, :added_by, added_by), else: r end)

    Repo.insert_all(
      "allowed_emails",
      [row],
      on_conflict: :nothing,
      conflict_target: :email
    )

    :ok
  end

  @doc """
  Removes an email from the allowlist.
  """
  def remove_allowed_email(email) when is_binary(email) do
    normalized = String.downcase(email)
    Repo.delete_all(from ae in "allowed_emails", where: ae.email == ^normalized)
    :ok
  end

  @doc """
  Lists all emails on the allowlist.
  """
  def list_allowed_emails do
    Repo.all(from ae in "allowed_emails", select: ae.email, order_by: ae.email)
  end

  # ---------------------------------------------------------------------------
  # First-admin seeding
  # ---------------------------------------------------------------------------

  @doc """
  Seeds the first admin user. Called at application start.

  If `FIRST_ADMIN_EMAIL` is set:
  - Ensures that email is on the allowlist.
  - If a user with that email already exists, promotes them to admin.
  - If no user exists yet, the allowlist entry ensures they can log in and
    be created as admin on their first OAuth login (handled in find_or_create_user/1).
  """
  def seed_first_admin do
    case System.get_env("FIRST_ADMIN_EMAIL") do
      nil ->
        :noop

      "" ->
        :noop

      email ->
        normalized = String.downcase(email)
        allow_email(normalized)

        case get_user_by_email(normalized) do
          nil ->
            :pending

          %User{role: "admin"} ->
            :already_admin

          %User{} = user ->
            user
            |> User.changeset(%{role: "admin"})
            |> Repo.update!()

            :promoted
        end
    end
  end

  defp is_first_admin_email?(email) do
    case System.get_env("FIRST_ADMIN_EMAIL") do
      nil -> false
      "" -> false
      admin_email -> String.downcase(admin_email) == email
    end
  end

  # ---------------------------------------------------------------------------
  # Users (admin operations)
  # ---------------------------------------------------------------------------

  @doc """
  Lists all users, ordered by insertion date (newest first).
  """
  def list_users do
    Repo.all(from u in User, order_by: [desc: u.inserted_at])
  end

  @doc """
  Promotes a user to admin role.
  """
  def promote_to_admin(%User{} = user) do
    user
    |> User.changeset(%{role: "admin"})
    |> Repo.update()
  end

  @doc """
  Revokes a user's access by deleting all their sessions.
  The user record is kept for audit purposes.
  """
  def revoke_access(%User{id: user_id}) do
    Repo.delete_all(from s in Session, where: s.user_id == ^user_id)
    :ok
  end

  # ---------------------------------------------------------------------------
  # Sessions
  # ---------------------------------------------------------------------------

  @session_token_length 32

  @doc """
  Creates a new session for `user`.

  Returns `{:ok, {raw_token, session}}` where `raw_token` is the plain-text
  token to be stored in the cookie and `session` is the persisted record.
  The database only stores the SHA-256 hash of the token, never the raw value.
  """
  def create_session(%User{id: user_id}, opts \\ []) do
    raw_token = :crypto.strong_rand_bytes(@session_token_length) |> Base.url_encode64(padding: false)
    token_hash = hash_token(raw_token)

    max_age = Keyword.get(opts, :max_age, session_max_age())

    expires_at =
      DateTime.utc_now()
      |> DateTime.add(max_age, :second)
      |> DateTime.truncate(:second)

    changeset =
      Session.changeset(%Session{}, %{
        user_id: user_id,
        token_hash: token_hash,
        expires_at: expires_at,
        user_agent: Keyword.get(opts, :user_agent),
        ip_address: Keyword.get(opts, :ip_address)
      })

    case Repo.insert(changeset) do
      {:ok, session} -> {:ok, {raw_token, session}}
      {:error, changeset} -> {:error, changeset}
    end
  end

  @doc """
  Looks up the session matching `raw_token` and returns
  `{:ok, user}` if the session is valid and not expired,
  or `{:error, :invalid}` otherwise.
  """
  def get_user_by_session_token(raw_token) when is_binary(raw_token) do
    token_hash = hash_token(raw_token)
    now = DateTime.utc_now()

    query =
      from s in Session,
        join: u in assoc(s, :user),
        where: s.token_hash == ^token_hash and s.expires_at > ^now,
        select: u

    case Repo.one(query) do
      nil -> {:error, :invalid}
      user -> {:ok, user}
    end
  end

  @doc """
  Deletes the session associated with `raw_token`.
  No-op if the token is unknown.
  """
  def delete_session(raw_token) when is_binary(raw_token) do
    token_hash = hash_token(raw_token)
    Repo.delete_all(from s in Session, where: s.token_hash == ^token_hash)
    :ok
  end

  @doc """
  Deletes all sessions for a given user (force logout all devices).
  """
  def delete_all_user_sessions(%User{id: user_id}) do
    Repo.delete_all(from s in Session, where: s.user_id == ^user_id)
    :ok
  end

  @doc """
  Purges expired sessions from the database.
  Can be called periodically from a maintenance task.
  """
  def purge_expired_sessions do
    now = DateTime.utc_now()
    {count, _} = Repo.delete_all(from s in Session, where: s.expires_at <= ^now)
    count
  end

  # ---------------------------------------------------------------------------
  # Private helpers
  # ---------------------------------------------------------------------------

  defp hash_token(raw_token) do
    :crypto.hash(:sha256, raw_token) |> Base.url_encode64(padding: false)
  end

  defp session_max_age do
    String.to_integer(System.get_env("SESSION_MAX_AGE", "2592000"))
  end

  defp utc_now do
    DateTime.utc_now() |> DateTime.truncate(:second)
  end
end
