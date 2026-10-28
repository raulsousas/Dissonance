defmodule Guilda.Repo.Migrations.CreateMessages do
  use Ecto.Migration

  def change do
    create table(:messages, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :channel_id, references(:channels, type: :binary_id, on_delete: :delete_all), null: false
      add :author_id, references(:users, type: :binary_id, on_delete: :nilify_all), null: false
      add :content, :text, null: false
      # Populated when the message is edited
      add :edited_at, :utc_datetime
      # Self-referential FK for replies
      add :reply_to_id, references(:messages, type: :binary_id, on_delete: :nilify_all)
      # Soft-delete flag (content replaced with "[deleted]" on delete)
      add :deleted, :boolean, null: false, default: false

      timestamps(updated_at: false)
    end

    # Keyset pagination: fetch messages before a given inserted_at + id
    create index(:messages, [:channel_id, :inserted_at, :id])
    create index(:messages, [:author_id])
    create index(:messages, [:reply_to_id])
  end
end
