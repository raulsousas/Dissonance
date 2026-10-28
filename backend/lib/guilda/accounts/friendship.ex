defmodule Guilda.Accounts.Friendship do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @valid_statuses ~w(pending accepted blocked)

  schema "friendships" do
    field :status, :string, default: "pending"

    belongs_to :requester, Guilda.Accounts.User
    belongs_to :addressee, Guilda.Accounts.User

    timestamps()
  end

  @required ~w(requester_id addressee_id)a
  @optional ~w(status)a

  def changeset(friendship, attrs) do
    friendship
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_inclusion(:status, @valid_statuses)
    |> assoc_constraint(:requester)
    |> assoc_constraint(:addressee)
    |> unique_constraint([:requester_id, :addressee_id])
  end
end
