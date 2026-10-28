defmodule Guilda.Repo.Migrations.CreateInvites do
  use Ecto.Migration

  def change do
    create table(:invites, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :server_id, references(:servers, type: :binary_id, on_delete: :delete_all), null: false
      add :created_by, references(:users, type: :binary_id, on_delete: :nilify_all), null: false
      # Short random code shown in the invite URL
      add :code, :string, null: false
      # nil = unlimited uses
      add :max_uses, :integer
      add :uses, :integer, null: false, default: 0
      # nil = never expires
      add :expires_at, :utc_datetime

      timestamps(updated_at: false)
    end

    create unique_index(:invites, [:code])
    create index(:invites, [:server_id])
    create index(:invites, [:expires_at])
  end
end
