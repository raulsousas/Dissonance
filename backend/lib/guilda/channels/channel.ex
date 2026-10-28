defmodule Guilda.Channels.Channel do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @valid_types ~w(text voice)

  schema "channels" do
    field :name, :string
    field :type, :string, default: "text"
    field :topic, :string
    field :position, :integer, default: 0
    field :slowmode_seconds, :integer, default: 0

    belongs_to :server, Guilda.Servers.Server
    belongs_to :category, Guilda.Channels.Category
    has_many :messages, Guilda.Messaging.Message

    timestamps()
  end

  @required ~w(name server_id type)a
  @optional ~w(category_id topic position slowmode_seconds)a

  def changeset(channel, attrs) do
    channel
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_length(:name, min: 1, max: 100)
    |> validate_inclusion(:type, @valid_types)
    |> validate_number(:slowmode_seconds, greater_than_or_equal_to: 0, less_than_or_equal_to: 21600)
    |> assoc_constraint(:server)
    |> assoc_constraint(:category)
  end
end
