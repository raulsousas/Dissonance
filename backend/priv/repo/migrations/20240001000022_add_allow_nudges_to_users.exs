defmodule Guilda.Repo.Migrations.AddAllowNudgesToUsers do
  use Ecto.Migration

  def change do
    alter table(:users) do
      add :allow_nudges, :boolean, default: true, null: false
    end
  end
end
