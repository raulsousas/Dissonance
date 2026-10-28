defmodule Guilda.Repo.Migrations.CreateServers do
  use Ecto.Migration

  def change do
    create table(:servers, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :name, :string, null: false
      add :description, :text
      add :icon_url, :string
      add :owner_id, references(:users, type: :binary_id, on_delete: :restrict), null: false

      timestamps()
    end

    create index(:servers, [:owner_id])
    create index(:servers, [:name])
  end
end
