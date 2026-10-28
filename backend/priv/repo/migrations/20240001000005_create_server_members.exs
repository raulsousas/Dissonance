defmodule Guilda.Repo.Migrations.CreateServerMembers do
  use Ecto.Migration

  def change do
    create table(:server_members, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :server_id, references(:servers, type: :binary_id, on_delete: :delete_all), null: false
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :role_id, references(:roles, type: :binary_id, on_delete: :nilify_all)
      add :nickname, :string
      add :joined_at, :utc_datetime, null: false

      timestamps()
    end

    create unique_index(:server_members, [:server_id, :user_id])
    create index(:server_members, [:user_id])
    create index(:server_members, [:role_id])
  end
end
