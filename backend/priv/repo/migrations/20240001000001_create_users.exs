defmodule Guilda.Repo.Migrations.CreateUsers do
  use Ecto.Migration

  def change do
    create table(:users, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :email, :string, null: false
      add :google_sub, :string, null: false
      add :display_name, :string, null: false
      add :avatar_url, :string
      # Global status: online | away | dnd | invisible | offline
      add :status, :string, null: false, default: "offline"
      # Global app role: member | admin
      add :role, :string, null: false, default: "member"

      timestamps()
    end

    create unique_index(:users, [:email])
    create unique_index(:users, [:google_sub])
    create index(:users, [:role])
  end
end
