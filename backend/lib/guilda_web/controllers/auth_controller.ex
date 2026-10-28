defmodule GuildaWeb.AuthController do
  @moduledoc """
  Handles Google OAuth 2.0 authentication via Ueberauth.

  Routes:
    GET  /auth/google           → redirects user to Google consent screen
    GET  /auth/google/callback  → receives code, creates session, sets cookie
    DELETE /auth/logout         → destroys session and clears cookie
  """

  use GuildaWeb, :controller

  alias Guilda.Accounts

  plug Ueberauth

  # -------------------------------------------------------------------------
  # Request — Ueberauth handles the redirect to Google automatically
  # -------------------------------------------------------------------------

  def request(conn, _params) do
    # Ueberauth.Strategy.Google handles the redirect.
    # This action is reached only if the strategy does not redirect,
    # which should not happen in normal operation.
    conn
    |> put_status(:bad_request)
    |> json(%{error: "OAuth provider not configured"})
  end

  # -------------------------------------------------------------------------
  # Callback — code has been exchanged, profile is in conn.assigns.ueberauth_auth
  # -------------------------------------------------------------------------

  def callback(%{assigns: %{ueberauth_failure: failure}} = conn, _params) do
    reason = failure_reason(failure)

    require Logger
    Logger.error("[AuthController] OAuth failure: #{inspect(failure)}")

    conn
    |> redirect(external: frontend_url() <> "/login?error=#{URI.encode(reason)}")
  end

  def callback(%{assigns: %{ueberauth_auth: auth}} = conn, _params) do
    profile = %{
      google_sub: auth.uid,
      email: auth.info.email,
      display_name: auth.info.name || auth.info.email,
      avatar_url: auth.info.image
    }

    require Logger

    case Accounts.find_or_create_user(profile) do
      {:ok, user} ->
        {:ok, {raw_token, _session}} =
          Accounts.create_session(user,
            user_agent: get_req_header(conn, "user-agent") |> List.first(),
            ip_address: remote_ip(conn)
          )

        Logger.info("[AuthController] Login OK user=#{user.email} role=#{user.role}")

        conn
        |> put_session(:token, raw_token)
        |> configure_session(renew: true)
        |> redirect(external: frontend_url() <> "/app")

      {:error, :unauthorized} ->
        Logger.warning("[AuthController] Unauthorized login attempt email=#{profile.email}")

        conn
        |> redirect(external: frontend_url() <> "/login?error=unauthorized")

      {:error, changeset} ->
        Logger.error("[AuthController] User upsert failed: #{inspect(changeset)}")

        conn
        |> redirect(external: frontend_url() <> "/login?error=server_error")
    end
  end

  # -------------------------------------------------------------------------
  # Logout
  # -------------------------------------------------------------------------

  def logout(conn, _params) do
    case get_session(conn, :token) do
      nil -> :ok
      token -> Accounts.delete_session(token)
    end

    conn
    |> configure_session(drop: true)
    |> send_resp(:no_content, "")
  end

  # -------------------------------------------------------------------------
  # Private helpers
  # -------------------------------------------------------------------------

  defp frontend_url do
    System.get_env("FRONTEND_URL", "http://localhost:5173")
  end

  defp failure_reason(%Ueberauth.Failure{errors: [%{message: msg} | _]}), do: msg
  defp failure_reason(_), do: "oauth_error"

  defp remote_ip(conn) do
    case get_req_header(conn, "x-forwarded-for") do
      [ip | _] -> ip |> String.split(",") |> List.first() |> String.trim()
      [] -> conn.remote_ip |> :inet.ntoa() |> to_string()
    end
  end
end
