defmodule Guilda.Repo.Migrations.CreateChannelMutes do
  use Ecto.Migration

  def change do
    # Focus mode: a user silences a server channel. Muted channels produce no
    # unread badge, sound or desktop notification; the channel shows a short
    # summary of what was missed when it is opened again.
    create table(:channel_mutes, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :channel_id, references(:channels, type: :binary_id, on_delete: :delete_all), null: false
      add :muted_at, :utc_datetime, null: false

      timestamps(updated_at: false)
    end

    create unique_index(:channel_mutes, [:user_id, :channel_id])
    create index(:channel_mutes, [:channel_id])
  end
end
