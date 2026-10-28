defmodule Guilda.Repo.Migrations.CreateMessageAttachments do
  use Ecto.Migration

  def change do
    create table(:message_attachments, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :message_id, references(:messages, type: :binary_id, on_delete: :delete_all), null: false
      # URL to file in MinIO / S3
      add :url, :string, null: false
      add :filename, :string, null: false
      # File size in bytes
      add :size, :integer, null: false
      add :content_type, :string, null: false
      # Dimensions for images (nullable)
      add :width, :integer
      add :height, :integer

      timestamps(updated_at: false)
    end

    create index(:message_attachments, [:message_id])
  end
end
