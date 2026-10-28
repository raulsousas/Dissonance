defmodule Guilda.Repo.Migrations.CreateChannels do
  use Ecto.Migration

  def change do
    create table(:channels, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :server_id, references(:servers, type: :binary_id, on_delete: :delete_all), null: false
      add :category_id, references(:channel_categories, type: :binary_id, on_delete: :nilify_all)
      add :name, :string, null: false
      # text | voice
      add :type, :string, null: false, default: "text"
      add :topic, :text
      add :position, :integer, null: false, default: 0
      # Slowmode delay in seconds (0 = disabled)
      add :slowmode_seconds, :integer, null: false, default: 0

      timestamps()
    end

    create index(:channels, [:server_id])
    create index(:channels, [:server_id, :position])
    create index(:channels, [:category_id])
    create index(:channels, [:type])
  end
end
