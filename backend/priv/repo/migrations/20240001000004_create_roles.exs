defmodule Guilda.Repo.Migrations.CreateRoles do
  use Ecto.Migration

  def change do
    create table(:roles, primary_key: false) do
      add :id, :binary_id, primary_key: true
      add :server_id, references(:servers, type: :binary_id, on_delete: :delete_all), null: false
      add :name, :string, null: false
      # Bitmask integer encoding permissions. See Guilda.Servers.Permissions.
      # Bit 0  = MANAGE_SERVER   (1)
      # Bit 1  = MANAGE_CHANNELS (2)
      # Bit 2  = MANAGE_INVITES  (4)
      # Bit 3  = MANAGE_MEMBERS  (8)
      # Bit 4  = DELETE_MESSAGES (16)
      # Bit 5  = SEND_MESSAGES   (32)
      # Bit 6  = ATTACH_FILES    (64)
      # Bit 7  = CONNECT_VOICE   (128)
      # Bit 8  = SPEAK_VOICE     (256)
      # Bit 9  = VIDEO           (512)
      add :permissions, :integer, null: false, default: 32
      # Lower number = higher in the hierarchy
      add :position, :integer, null: false, default: 0
      # True for the auto-assigned default member role
      add :is_default, :boolean, null: false, default: false

      timestamps()
    end

    create index(:roles, [:server_id])
    create unique_index(:roles, [:server_id, :name])
  end
end
