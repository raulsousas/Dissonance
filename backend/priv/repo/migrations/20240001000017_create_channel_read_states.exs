defmodule Guilda.Repo.Migrations.CreateChannelReadStates do
  use Ecto.Migration

  def change do
    # Tracks the last message each user has read in each channel.
    # Used to compute unread counts without scanning all messages.
    create table(:channel_read_states, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :channel_id, references(:channels, type: :binary_id, on_delete: :delete_all), null: false
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      # The last message ID the user has acknowledged
      add :last_read_message_id, :binary_id
      add :last_read_at, :utc_datetime

      timestamps()
    end

    create unique_index(:channel_read_states, [:channel_id, :user_id])
    create index(:channel_read_states, [:user_id])
  end
end
