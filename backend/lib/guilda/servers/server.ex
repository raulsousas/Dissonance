defmodule Guilda.Servers.Server do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "servers" do
    field :name, :string
    field :description, :string
    field :icon_url, :string

    belongs_to :owner, Guilda.Accounts.User
    has_many :roles, Guilda.Servers.Role
    has_many :server_members, Guilda.Servers.ServerMember
    has_many :members, through: [:server_members, :user]
    has_many :channel_categories, Guilda.Channels.Category
    has_many :channels, Guilda.Channels.Channel
    has_many :invites, Guilda.Servers.Invite

    timestamps()
  end

  @required ~w(name owner_id)a
  @optional ~w(description icon_url)a

  def changeset(server, attrs) do
    server
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_length(:name, min: 2, max: 100)
    |> assoc_constraint(:owner)
  end
end
