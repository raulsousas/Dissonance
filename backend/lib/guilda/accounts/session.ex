defmodule Guilda.Accounts.Session do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "sessions" do
    field :token_hash, :string
    field :expires_at, :utc_datetime
    field :user_agent, :string
    field :ip_address, :string

    belongs_to :user, Guilda.Accounts.User

    timestamps(updated_at: false)
  end

  @required ~w(user_id token_hash expires_at)a
  @optional ~w(user_agent ip_address)a

  def changeset(session, attrs) do
    session
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> unique_constraint(:token_hash)
    |> assoc_constraint(:user)
  end
end
