defmodule Guilda.Repo.Migrations.CreateAllowedEmails do
  use Ecto.Migration

  def change do
    create table(:allowed_emails, primary_key: false) do
      add :email, :string, primary_key: true
      # Who added this email (nil = seeded by FIRST_ADMIN_EMAIL env var)
      add :added_by, references(:users, type: :binary_id, on_delete: :nilify_all)

      timestamps(updated_at: false)
    end

    create index(:allowed_emails, [:added_by])
  end
end
