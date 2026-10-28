defmodule Guilda.DirectMessaging.DirectMessage do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "direct_messages" do
    field :content, :string
    field :edited_at, :utc_datetime
    field :deleted, :boolean, default: false

    belongs_to :conversation, Guilda.DirectMessaging.Conversation
    belongs_to :author, Guilda.Accounts.User

    timestamps(updated_at: false)
  end

  @required ~w(conversation_id author_id content)a
  @optional ~w(edited_at deleted)a

  def changeset(message, attrs) do
    message
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_length(:content, min: 1, max: 4000)
  end
end
