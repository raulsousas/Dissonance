defmodule Guilda.Application do
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Database
      Guilda.Repo,

      # PubSub
      {Phoenix.PubSub, name: Guilda.PubSub},

      # Presence tracker
      GuildaWeb.Presence,

      # Redix connection pool for Redis
      {Redix, {System.get_env("REDIS_URL", "redis://localhost:6379"), [name: :redix]}},

      # Fires due message reminders (state lives in Postgres)
      Guilda.Reminders.Worker,

      # Endpoint (must be last)
      GuildaWeb.Endpoint
    ]

    opts = [strategy: :one_for_one, name: Guilda.Supervisor]
    result = Supervisor.start_link(children, opts)

    # Seed the first admin after the supervision tree is up
    seed_first_admin()

    result
  end

  @impl true
  def config_change(changed, _new, removed) do
    GuildaWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  # ---------------------------------------------------------------------------
  # Private
  # ---------------------------------------------------------------------------

  defp seed_first_admin do
    try do
      case Guilda.Accounts.seed_first_admin() do
        :noop -> :ok
        :pending -> log("First admin email set; user will be promoted on first login.")
        :already_admin -> :ok
        :promoted -> log("First admin user promoted.")
      end
    rescue
      e ->
        # Database may not be migrated yet in CI or first boot — log and continue.
        require Logger
        Logger.warning("seed_first_admin/0 failed (may be expected on first boot): #{inspect(e)}")
    end
  end

  defp log(msg) do
    require Logger
    Logger.info("[Guilda.Application] #{msg}")
  end
end
