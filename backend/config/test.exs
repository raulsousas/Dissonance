import Config

config :guilda, ecto_repos: [Guilda.Repo]

config :guilda, GuildaWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "test_secret_key_base_at_least_64_bytes_long_for_testing_only_do_not_use_in_prod",
  server: false

config :guilda, Guilda.Repo,
  username: "guilda",
  password: "guilda",
  hostname: System.get_env("POSTGRES_HOST", "postgres"),
  database: "guilda_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: 10

config :logger, level: :warning
config :phoenix, :plug_init_mode, :runtime
