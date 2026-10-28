defmodule Guilda.MixProject do
  use Mix.Project

  def project do
    [
      app: :guilda,
      version: "0.1.0",
      elixir: "~> 1.15",
      elixirc_paths: elixirc_paths(Mix.env()),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps()
    ]
  end

  def application do
    [
      mod: {Guilda.Application, []},
      extra_applications: [:logger, :runtime_tools, :crypto]
    ]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  defp deps do
    [
      # Phoenix core
      {:phoenix, "~> 1.8.0"},
      {:phoenix_pubsub, "~> 2.1"},
      {:phoenix_ecto, "~> 4.6"},
      {:ecto_sql, "~> 3.12"},
      {:postgrex, ">= 0.0.0"},
      {:bandit, "~> 1.5"},

      # JSON
      {:jason, "~> 1.4"},

      # Redis
      {:redix, "~> 1.5"},

      # HTTP client (for OAuth token exchange)
      {:req, "~> 0.5"},

      # S3 / LocalStack (local dev) / real S3 or R2 (production)
      {:ex_aws, "~> 2.5"},
      {:ex_aws_s3, "~> 2.5"},
      # Use finch instead of hackney (hackney has multiple CVEs in 1.x)
      {:finch, "~> 0.19"},
      {:sweet_xml, "~> 0.7"},

      # Authentication
      {:ueberauth, "~> 0.10"},
      {:ueberauth_google, "~> 0.10"},

      # Rate limiting
      {:plug_attack, "~> 0.4"},

      # CORS
      {:cors_plug, "~> 3.0"},

      # Test
      {:ex_machina, "~> 2.8", only: :test},

      # Dev
      {:credo, "~> 1.7", only: [:dev, :test], runtime: false}
    ]
  end

  defp aliases do
    [
      setup: ["deps.get", "ecto.setup"],
      "ecto.setup": ["ecto.create", "ecto.migrate", "run priv/repo/seeds.exs"],
      "ecto.reset": ["ecto.drop", "ecto.setup"],
      test: ["ecto.create --quiet", "ecto.migrate --quiet", "test"]
    ]
  end
end
