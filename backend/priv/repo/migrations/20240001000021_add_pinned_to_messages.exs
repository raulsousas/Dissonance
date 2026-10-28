defmodule Guilda.Repo.Migrations.AddPinnedToMessages do
  use Ecto.Migration

  def change do
    alter table(:messages) do
      add :pinned, :boolean, default: false, null: false
    end

    alter table(:direct_messages) do
      add :pinned, :boolean, default: false, null: false
    end

    create index(:messages, [:channel_id, :pinned])
    create index(:direct_messages, [:conversation_id, :pinned])
  end
end
