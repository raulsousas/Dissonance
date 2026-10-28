defmodule Guilda.Repo.Migrations.CreateFriendships do
  use Ecto.Migration

  def change do
    create table(:friendships, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :requester_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :addressee_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      # pending | accepted | blocked
      add :status, :string, null: false, default: "pending"

      timestamps()
    end

    # Prevent duplicate friendship rows in either direction
    create unique_index(:friendships, [:requester_id, :addressee_id])
    create index(:friendships, [:addressee_id])
    create index(:friendships, [:status])
  end
end
