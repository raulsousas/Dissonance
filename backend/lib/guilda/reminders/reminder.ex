defmodule Guilda.Reminders.Reminder do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "message_reminders" do
    field :scope, :string
    field :server_id, :binary_id
    field :channel_id, :binary_id
    field :message_id, :binary_id
    field :author_name, :string
    field :preview, :string
    field :remind_at, :utc_datetime
    field :notified_at, :utc_datetime

    belongs_to :user, Guilda.Accounts.User

    timestamps(updated_at: false)
  end

  @fields ~w(user_id scope server_id channel_id message_id author_name preview remind_at)a
  @required ~w(user_id scope channel_id message_id remind_at)a

  def changeset(reminder, attrs) do
    reminder
    |> cast(attrs, @fields)
    |> validate_required(@required)
    |> validate_inclusion(:scope, ["channel", "dm"])
    |> validate_length(:preview, max: 200)
    |> assoc_constraint(:user)
  end
end
