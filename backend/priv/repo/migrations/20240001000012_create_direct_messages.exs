defmodule Guilda.Repo.Migrations.CreateDirectMessages do
  use Ecto.Migration

  def change do
    create table(:direct_messages, primary_key: false) do
      add :id, :binary_id, primary_key: true

      add :conversation_id,
          references(:direct_conversations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :author_id, references(:users, type: :binary_id, on_delete: :nilify_all), null: false
      add :content, :text, null: false
      add :edited_at, :utc_datetime
      add :deleted, :boolean, null: false, default: false

      timestamps(updated_at: false)
    end

    create index(:direct_messages, [:conversation_id, :inserted_at, :id])
    create index(:direct_messages, [:author_id])
  end
end
