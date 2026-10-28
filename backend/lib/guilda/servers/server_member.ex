defmodule Guilda.Servers.ServerMember do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "server_members" do
    field :nickname, :string
    field :joined_at, :utc_datetime

    belongs_to :server, Guilda.Servers.Server
    belongs_to :user, Guilda.Accounts.User
    belongs_to :role, Guilda.Servers.Role

    timestamps()
  end

  @required ~w(server_id user_id joined_at)a
  @optional ~w(role_id nickname)a

  def changeset(member, attrs) do
    member
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> assoc_constraint(:server)
    |> assoc_constraint(:user)
    |> assoc_constraint(:role)
    |> unique_constraint([:server_id, :user_id])
  end
end
