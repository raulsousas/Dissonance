defmodule Guilda.Repo.Migrations.CreateChannelCategories do
  use Ecto.Migration

  def change do
    create table(:channel_categories, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :server_id, references(:servers, type: :binary_id, on_delete: :delete_all), null: false
      add :name, :string, null: false
      add :position, :integer, null: false, default: 0

      timestamps()
    end

    create index(:channel_categories, [:server_id])
    create index(:channel_categories, [:server_id, :position])
  end
end
