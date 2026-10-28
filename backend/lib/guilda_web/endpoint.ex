defmodule GuildaWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :guilda

  # Session options
  @session_options [
    store: :cookie,
    key: System.get_env("SESSION_COOKIE_NAME") || "_guilda_session",
    signing_salt: "guilda_signing_salt",
    same_site: "Lax",
    http_only: true,
    max_age: 60 * 60 * 24 * 30
  ]

  socket "/socket", GuildaWeb.UserSocket,
    websocket: [
      connect_info: [:peer_data, :x_headers, session: @session_options]
    ],
    longpoll: false

  plug Plug.Static,
    at: "/",
    from: :guilda,
    gzip: false,
    only: GuildaWeb.static_paths()

  plug Plug.Static,
    at: "/uploads",
    from: Path.expand("priv/static/uploads"),
    gzip: false

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library(),
    length: String.to_integer(System.get_env("MAX_UPLOAD_BYTES") || "26214400")

  plug Plug.MethodOverride
  plug Plug.Head
  plug Plug.Session, @session_options

  plug CORSPlug,
    origin: [
      System.get_env("FRONTEND_URL") || "http://localhost:5173"
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    headers: ["Authorization", "Content-Type", "Accept", "Origin"],
    credentials: true,
    max_age: 86_400

  plug GuildaWeb.Router
end
