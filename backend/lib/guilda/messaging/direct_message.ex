defmodule Guilda.Messaging.DirectMessage do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "direct_messages" do
    field :content, :string
    field :edited_at, :utc_datetime
    field :deleted, :boolean, default: false

    belongs_to :conversation, Guilda.Messaging.DirectConversation
    belongs_to :author, Guilda.Accounts.User

    timestamps(updated_at: false)
  end

  @required ~w(content conversation_id author_id)a
  @optional ~w(edited_at deleted)a

  def changeset(dm, attrs) do
    dm
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_length(:content, min: 1, max: 4000)
    |> assoc_constraint(:conversation)
    |> assoc_constraint(:author)
  end

  def edit_changeset(dm, attrs) do
    dm
    |> cast(attrs, [:content])
    |> validate_required([:content])
    |> validate_length(:content, min: 1, max: 4000)
    |> put_change(:edited_at, DateTime.utc_now() |> DateTime.truncate(:second))
  end
end
