defmodule Guilda.Accounts.AdminLog do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "admin_logs" do
    field :action, :string
    field :target_type, :string
    field :target_id, :binary_id
    field :metadata, :map, default: %{}

    belongs_to :actor, Guilda.Accounts.User

    timestamps(updated_at: false)
  end

  @required ~w(actor_id action)a
  @optional ~w(target_type target_id metadata)a

  def changeset(log, attrs) do
    log
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> assoc_constraint(:actor)
  end
end
