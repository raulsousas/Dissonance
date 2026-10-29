defmodule Guilda.Repo.Migrations.CreatePolls do
  use Ecto.Migration

  def change do
    # `channel_id` references either a server channel or a DM conversation,
    # so it is intentionally not a foreign key. `scope` tells which one.
    create table(:polls, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :scope, :string, null: false
      add :channel_id, :binary_id, null: false
      add :author_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :title, :string, null: false
      add :allow_suggestions, :boolean, null: false, default: false
      add :multiple_choice, :boolean, null: false, default: false
      add :allow_comments, :boolean, null: false, default: true
      add :expires_at, :utc_datetime
      add :closed, :boolean, null: false, default: false

      timestamps(updated_at: false)
    end

    create index(:polls, [:channel_id])

    create table(:poll_options, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :poll_id, references(:polls, type: :binary_id, on_delete: :delete_all), null: false
      add :text, :string, null: false
      add :position, :integer, null: false, default: 0
      add :suggested_by_id, references(:users, type: :binary_id, on_delete: :nilify_all)

      timestamps(updated_at: false)
    end

    create index(:poll_options, [:poll_id])

    create table(:poll_votes, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :poll_id, references(:polls, type: :binary_id, on_delete: :delete_all), null: false

      add :option_id, references(:poll_options, type: :binary_id, on_delete: :delete_all),
        null: false

      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false

      timestamps(updated_at: false)
    end

    create unique_index(:poll_votes, [:option_id, :user_id])
    create index(:poll_votes, [:poll_id])

    create table(:poll_comments, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :poll_id, references(:polls, type: :binary_id, on_delete: :delete_all), null: false
      add :user_id, references(:users, type: :binary_id, on_delete: :delete_all), null: false
      add :text, :string, null: false

      # Microsecond precision keeps comments posted in the same second ordered.
      timestamps(updated_at: false, type: :utc_datetime_usec)
    end

    create index(:poll_comments, [:poll_id])
  end
end
