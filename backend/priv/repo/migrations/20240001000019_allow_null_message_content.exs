defmodule Guilda.Repo.Migrations.AllowNullMessageContent do
  use Ecto.Migration

  def change do
    alter table(:messages) do
      modify :content, :text, null: true
    end

    alter table(:direct_messages) do
      modify :content, :text, null: true
    end
  end
end
