import Config

# In test mode, runtime.exs is still evaluated but we skip server startup
# and external service configuration to allow `mix test` inside the container.
if config_env() != :test do
  config :guilda, GuildaWeb.Endpoint,
    http: [ip: {0, 0, 0, 0}, port: 4000],
    secret_key_base: System.get_env("SECRET_KEY_BASE") ||
      raise("SECRET_KEY_BASE environment variable is not set"),
    server: true

  # Google OAuth credentials — loaded at runtime so they can be injected
  # via environment variables without rebuilding the image.
  if google_client_id = System.get_env("GOOGLE_CLIENT_ID") do
    redirect_uri = System.get_env("GOOGLE_REDIRECT_URI") ||
      raise("GOOGLE_REDIRECT_URI must be set when GOOGLE_CLIENT_ID is provided")

    config :ueberauth, Ueberauth,
      providers: [
        google: {Ueberauth.Strategy.Google, [
          default_scope: "openid email profile",
          callback_url: redirect_uri
        ]}
      ]

    config :ueberauth, Ueberauth.Strategy.Google.OAuth,
      client_id: google_client_id,
      client_secret: System.get_env("GOOGLE_CLIENT_SECRET") ||
        raise("GOOGLE_CLIENT_SECRET must be set when GOOGLE_CLIENT_ID is provided"),
      redirect_uri: redirect_uri
  end

  config :guilda, Guilda.Repo,
    url: System.get_env("DATABASE_URL") ||
      raise("DATABASE_URL environment variable is not set"),
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
    ssl: false
end

if config_env() != :test do
  config :logger, level: :info

  # ExAws — S3 runtime config from environment variables.
  # In local dev this points to LocalStack; in production point to real S3/R2.
  config :ex_aws,
    access_key_id: System.get_env("S3_ACCESS_KEY") ||
      raise("S3_ACCESS_KEY environment variable is not set"),
    secret_access_key: System.get_env("S3_SECRET_KEY") ||
      raise("S3_SECRET_KEY environment variable is not set")

  if s3_endpoint = System.get_env("S3_ENDPOINT") do
    uri = URI.parse(s3_endpoint)

    config :ex_aws, :s3,
      scheme: "#{uri.scheme}://",
      host: uri.host,
      port: uri.port || 443,
      region: System.get_env("S3_REGION", "us-east-1")
  end
end
