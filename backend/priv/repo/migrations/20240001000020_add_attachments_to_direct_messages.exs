defmodule Guilda.Repo.Migrations.AddAttachmentsToDirectMessages do
  use Ecto.Migration

  def change do
    alter table(:direct_messages) do
      add :attachments, :jsonb, default: "[]"
    end
  end
end
