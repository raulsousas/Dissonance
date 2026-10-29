defmodule Guilda.Repo.Migrations.CreateMessageReminders do
  use Ecto.Migration

  def change do
    # `channel_id` / `message_id` point to either a server channel message or a
    # DM message (see `scope`), so they are intentionally not foreign keys. The
    # reminder keeps a short snapshot so it still makes sense if the message is
    # edited or deleted later.
    #
    # `notified_at` is set by the worker when the reminder fires. The row stays
    # until the client acknowledges it (DELETE), so a reminder that fired while
    # the user was offline is still shown on the next app load.
    create table(:message_reminders, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :scope, :string, null: false
      add :server_id, :binary_id
      add :channel_id, :binary_id, null: false
      add :message_id, :binary_id, null: false
      add :author_name, :string
      add :preview, :string, size: 200
      add :remind_at, :utc_datetime, null: false
      add :notified_at, :utc_datetime

      timestamps(updated_at: false)
    end

    create index(:message_reminders, [:user_id])
    create index(:message_reminders, [:remind_at], where: "notified_at IS NULL")
  end
end
