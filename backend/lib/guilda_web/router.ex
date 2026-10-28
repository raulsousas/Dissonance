defmodule GuildaWeb.Router do
  use GuildaWeb, :router

  # ---------------------------------------------------------------------------
  # Pipelines
  # ---------------------------------------------------------------------------

  pipeline :api do
    plug :accepts, ["json"]
    plug :fetch_session
    plug GuildaWeb.AuthPlug
  end

  pipeline :auth do
    plug :accepts, ["html", "json"]
    plug :fetch_session
  end

  pipeline :require_auth do
    plug GuildaWeb.RequireAuthPlug
  end

  pipeline :require_admin do
    plug GuildaWeb.RequireAuthPlug
    plug GuildaWeb.RequireAdminPlug
  end

  # ---------------------------------------------------------------------------
  # Health (public, no session needed)
  # ---------------------------------------------------------------------------

  scope "/", GuildaWeb do
    pipe_through :api

    get "/health", HealthController, :index
  end

  # ---------------------------------------------------------------------------
  # OAuth routes — handled by Ueberauth
  # ---------------------------------------------------------------------------

  scope "/auth", GuildaWeb do
    pipe_through :auth

    get "/google", AuthController, :request
    get "/google/callback", AuthController, :callback
    delete "/logout", AuthController, :logout
  end

  # ---------------------------------------------------------------------------
  # Public API (no auth required)
  # ---------------------------------------------------------------------------

  # (none for now — Phase 3 will add invite lookup)

  # ---------------------------------------------------------------------------
  # Public invite preview (no auth)
  # ---------------------------------------------------------------------------

  scope "/api", GuildaWeb do
    pipe_through :api

    get "/invites/:code", ServerController, :preview_invite
  end

  # ---------------------------------------------------------------------------
  # Protected API (requires valid session)
  # ---------------------------------------------------------------------------

  scope "/api", GuildaWeb do
    pipe_through [:api, :require_auth]

    get "/me", AccountController, :me

    # Servers
    get    "/servers",          ServerController, :index
    post   "/servers",          ServerController, :create
    post   "/servers/join",     ServerController, :join
    get    "/servers/:server_id",              ServerController, :show
    patch  "/servers/:server_id",              ServerController, :update
    delete "/servers/:server_id",              ServerController, :delete
    delete "/servers/:server_id/members/me",   ServerController, :leave
    get    "/servers/:server_id/invites",      ServerController, :list_invites
    post   "/servers/:server_id/invites",      ServerController, :create_invite
    delete "/servers/:server_id/invites/:code", ServerController, :delete_invite

    # Channels (all require server membership via ServerMemberPlug scoped below)
    get    "/servers/:server_id/channels",        ChannelController, :index
    post   "/servers/:server_id/channels",        ChannelController, :create
    post   "/servers/:server_id/categories",      ChannelController, :create_category
    patch  "/servers/:server_id/channels/:id",    ChannelController, :update
    delete "/servers/:server_id/channels/:id",    ChannelController, :delete

    # Messages (Phase 4)
    get    "/channels/:channel_id/messages", MessagesController, :index
    post   "/channels/:channel_id/messages", MessagesController, :create
  end

  # ---------------------------------------------------------------------------
  # Admin API (requires admin role)
  # ---------------------------------------------------------------------------

  scope "/api/admin", GuildaWeb do
    pipe_through [:api, :require_admin]

    get "/users", AdminController, :list_users
    post "/users/:id/promote", AdminController, :promote_user
    delete "/users/:id/access", AdminController, :revoke_access

    get "/allowed-emails", AdminController, :list_allowed_emails
    post "/allowed-emails", AdminController, :add_allowed_email
    delete "/allowed-emails/:email", AdminController, :remove_allowed_email
  end
end
