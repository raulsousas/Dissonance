defmodule Guilda.Notifications.Notification do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @valid_types ~w(
    message_mention
    friend_request
    friend_accepted
    server_invite
    dm
    server_event
  )

  schema "notifications" do
    field :type, :string
    field :data, :map, default: %{}
    field :read_at, :utc_datetime

    belongs_to :user, Guilda.Accounts.User

    timestamps(updated_at: false)
  end

  @required ~w(user_id type)a
  @optional ~w(data read_at)a

  def changeset(notification, attrs) do
    notification
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_inclusion(:type, @valid_types)
    |> assoc_constraint(:user)
  end

  def mark_read_changeset(notification) do
    change(notification, read_at: DateTime.utc_now() |> DateTime.truncate(:second))
  end
end
