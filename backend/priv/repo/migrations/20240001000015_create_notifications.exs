defmodule Guilda.Repo.Migrations.CreateNotifications do
  use Ecto.Migration

  def change do
    create table(:notifications, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      # message_mention | friend_request | friend_accepted | server_invite | dm | server_event
      add :type, :string, null: false
      # Flexible JSON payload (e.g. {server_id:, channel_id:, message_id:})
      add :data, :map, null: false, default: %{}
      add :read_at, :utc_datetime

      timestamps(updated_at: false)
    end

    create index(:notifications, [:user_id, :read_at])
    create index(:notifications, [:user_id, :inserted_at])
  end
end
