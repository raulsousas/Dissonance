defmodule Guilda.Repo.Migrations.CreateSessions do
  use Ecto.Migration

  def change do
    create table(:sessions, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      # Storing the hash of the token, never the raw token
      add :token_hash, :string, null: false
      add :expires_at, :utc_datetime, null: false
      # Optional metadata for session management UI
      add :user_agent, :string
      add :ip_address, :string

      timestamps(updated_at: false)
    end

    create unique_index(:sessions, [:token_hash])
    create index(:sessions, [:user_id])
    create index(:sessions, [:expires_at])
  end
end
