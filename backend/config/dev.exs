import Config

config :guilda, GuildaWeb.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: 4000],
  check_origin: false,
  code_reloader: true,
  debug_errors: true,
  secret_key_base: System.get_env("SECRET_KEY_BASE") ||
    raise("SECRET_KEY_BASE environment variable is not set"),
  watchers: []

config :guilda, Guilda.Repo,
  username: "guilda",
  password: "guilda",
  hostname: "postgres",
  database: "guilda_dev",
  show_sensitive_data_on_connection_error: true,
  pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
  url: System.get_env("DATABASE_URL")

config :logger, :console,
  format: "[$level] $message\n"

config :phoenix, :stacktrace_depth, 20
config :phoenix, :plug_init_mode, :runtime
