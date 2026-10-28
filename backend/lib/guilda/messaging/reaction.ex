defmodule Guilda.Messaging.Reaction do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "message_reactions" do
    field :emoji, :string

    belongs_to :message, Guilda.Messaging.Message
    belongs_to :user, Guilda.Accounts.User

    timestamps(updated_at: false)
  end

  @required ~w(emoji message_id user_id)a

  def changeset(reaction, attrs) do
    reaction
    |> cast(attrs, @required)
    |> validate_required(@required)
    |> validate_length(:emoji, min: 1, max: 32)
    |> assoc_constraint(:message)
    |> assoc_constraint(:user)
    |> unique_constraint([:message_id, :user_id, :emoji],
         message: "already reacted with this emoji")
  end
end
