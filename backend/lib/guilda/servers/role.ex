defmodule Guilda.Servers.Role do
  use Ecto.Schema
  import Ecto.Changeset

  alias Guilda.Servers.Permissions

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "roles" do
    field :name, :string
    field :permissions, :integer, default: Permissions.default_permissions()
    field :position, :integer, default: 0
    field :is_default, :boolean, default: false

    belongs_to :server, Guilda.Servers.Server

    timestamps()
  end

  @required ~w(name server_id permissions position)a
  @optional ~w(is_default)a

  def changeset(role, attrs) do
    role
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_length(:name, min: 1, max: 50)
    |> validate_number(:permissions, greater_than_or_equal_to: 0,
                                     less_than_or_equal_to: Permissions.all_permissions())
    |> assoc_constraint(:server)
    |> unique_constraint([:server_id, :name])
  end
end
