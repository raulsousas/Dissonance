defmodule Guilda.Messaging.ReadState do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "channel_read_states" do
    field :last_read_message_id, :binary_id
    field :last_read_at, :utc_datetime

    belongs_to :channel, Guilda.Channels.Channel
    belongs_to :user, Guilda.Accounts.User

    timestamps()
  end

  @required ~w(channel_id user_id)a
  @optional ~w(last_read_message_id last_read_at)a

  def changeset(read_state, attrs) do
    read_state
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> assoc_constraint(:channel)
    |> assoc_constraint(:user)
    |> unique_constraint([:channel_id, :user_id])
  end
end
