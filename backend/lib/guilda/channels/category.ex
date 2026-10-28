defmodule Guilda.Channels.Category do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "channel_categories" do
    field :name, :string
    field :position, :integer, default: 0

    belongs_to :server, Guilda.Servers.Server
    has_many :channels, Guilda.Channels.Channel, foreign_key: :category_id

    timestamps()
  end

  @required ~w(name server_id)a
  @optional ~w(position)a

  def changeset(category, attrs) do
    category
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_length(:name, min: 1, max: 100)
    |> assoc_constraint(:server)
  end
end
