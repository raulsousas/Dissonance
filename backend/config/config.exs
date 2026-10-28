import Config

# Ecto repositories
config :guilda, ecto_repos: [Guilda.Repo]

# Configures the endpoint
config :guilda, GuildaWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Bandit.PhoenixAdapter,
  render_errors: [
    formats: [json: GuildaWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: Guilda.PubSub,
  live_view: [signing_salt: "not_used"]

# Configure JSON library
config :phoenix, :json_library, Jason

# Configures Ecto
config :guilda, Guilda.Repo,
  migration_primary_key: [type: :binary_id],
  migration_foreign_key: [type: :binary_id]

# Ueberauth Google OAuth
config :ueberauth, Ueberauth,
  providers: [
    google: {Ueberauth.Strategy.Google, [default_scope: "openid email profile"]}
  ]

config :ueberauth, Ueberauth.Strategy.Google.OAuth,
  client_id: System.get_env("GOOGLE_CLIENT_ID"),
  client_secret: System.get_env("GOOGLE_CLIENT_SECRET"),
  redirect_uri: System.get_env("GOOGLE_REDIRECT_URI")

# ExAws (S3 / LocalStack in dev, real S3 in prod)
# Runtime values are loaded in config/runtime.exs from env vars.
config :ex_aws,
  access_key_id: System.get_env("S3_ACCESS_KEY", "guilda_local"),
  secret_access_key: System.get_env("S3_SECRET_KEY", "guilda_local_secret")

config :ex_aws, :s3,
  scheme: "http://",
  host: "localstack",
  port: 4566,
  region: System.get_env("S3_REGION", "us-east-1")

import_config "#{config_env()}.exs"
