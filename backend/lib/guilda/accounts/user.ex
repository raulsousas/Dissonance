defmodule Guilda.Accounts.User do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "users" do
    field :email, :string
    field :google_sub, :string
    field :display_name, :string
    field :avatar_url, :string
    field :status, :string, default: "offline"
    field :role, :string, default: "member"

    has_many :sessions, Guilda.Accounts.Session
    has_many :server_members, Guilda.Servers.ServerMember
    has_many :servers, through: [:server_members, :server]

    timestamps()
  end

  @required ~w(email google_sub display_name)a
  @optional ~w(avatar_url status role)a

  def changeset(user, attrs) do
    user
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_inclusion(:status, ~w(online away dnd invisible offline))
    |> validate_inclusion(:role, ~w(member admin))
    |> validate_format(:email, ~r/@/)
    |> unique_constraint(:email)
    |> unique_constraint(:google_sub)
  end

  def update_changeset(user, attrs) do
    user
    |> cast(attrs, [:display_name, :avatar_url, :status])
    |> validate_length(:display_name, min: 1, max: 100)
    |> validate_inclusion(:status, ~w(online away dnd invisible offline))
  end
end
