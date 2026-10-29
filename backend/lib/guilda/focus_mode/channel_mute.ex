defmodule Guilda.FocusMode.ChannelMute do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "channel_mutes" do
    field :muted_at, :utc_datetime

    belongs_to :user, Guilda.Accounts.User
    belongs_to :channel, Guilda.Channels.Channel

    timestamps(updated_at: false)
  end

  def changeset(mute, attrs) do
    mute
    |> cast(attrs, [:user_id, :channel_id, :muted_at])
    |> validate_required([:user_id, :channel_id, :muted_at])
    |> assoc_constraint(:user)
    |> assoc_constraint(:channel)
    |> unique_constraint([:user_id, :channel_id])
  end
end
