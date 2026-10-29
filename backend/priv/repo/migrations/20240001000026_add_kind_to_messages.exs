defmodule Guilda.Repo.Migrations.AddKindToMessages do
  use Ecto.Migration

  def change do
    # "user" = written by a person; "welcome" = automatic greeting posted by the
    # server when someone joins (never settable by clients, see Messaging).
    alter table(:messages) do
      add :kind, :string, null: false, default: "user"
    end
  end
end
