defmodule Guilda.Friendships.Friendship do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

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
    |> validate_inclusion(:status, ~w(pending accepted blocked))
    |> validate_different_users()
    |> unique_constraint([:requester_id, :addressee_id], name: :friendships_requester_id_addressee_id_index)
  end

  defp validate_different_users(changeset) do
    req = get_field(changeset, :requester_id)
    add = get_field(changeset, :addressee_id)

    if req && add && req == add do
      add_error(changeset, :addressee_id, "cannot friend yourself")
    else
      changeset
    end
  end
end
