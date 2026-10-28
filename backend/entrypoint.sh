#!/bin/sh
# Guilda backend entrypoint for development.
# Runs migrations and then starts the Phoenix server.
set -e

echo "==> Waiting for dependencies to be ready..."

echo "==> Installing/updating Elixir dependencies..."
mix deps.get

echo "==> Running database migrations..."
mix ecto.migrate

echo "==> Starting Phoenix server..."
exec mix phx.server
