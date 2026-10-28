defmodule Guilda.Repo.Migrations.CreateAdminLogs do
  use Ecto.Migration

  def change do
    create table(:admin_logs, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :actor_id, references(:users, type: :binary_id, on_delete: :nilify_all), null: false
      # approve_user | revoke_user | delete_server | kick_member | revoke_invite | etc.
      add :action, :string, null: false
      # user | server | channel | invite | session | etc.
      add :target_type, :string
      add :target_id, :binary_id
      # Arbitrary context (before/after state, reason, etc.)
      add :metadata, :map, null: false, default: %{}

      timestamps(updated_at: false)
    end

    create index(:admin_logs, [:actor_id])
    create index(:admin_logs, [:action])
    create index(:admin_logs, [:inserted_at])
    create index(:admin_logs, [:target_type, :target_id])
  end
end
