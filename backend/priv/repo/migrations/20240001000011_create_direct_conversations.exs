defmodule Guilda.Repo.Migrations.CreateDirectConversations do
  use Ecto.Migration

  def change do
    create table(:direct_conversations, primary_key: false) do
      add :id, :binary_id, primary_key: true

      timestamps(updated_at: false)
    end

    # Members of each DM conversation (exactly 2 users in Phase 1)
    create table(:direct_conversation_members, primary_key: false) do
      add :conversation_id,
          references(:direct_conversations, type: :binary_id, on_delete: :delete_all),
          null: false

      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
    end

    create unique_index(:direct_conversation_members, [:conversation_id, :user_id])
    create index(:direct_conversation_members, [:user_id])
  end
end
