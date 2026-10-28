defmodule Guilda.Messaging.Message do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "messages" do
    field :content, :string
    field :edited_at, :utc_datetime
    field :deleted, :boolean, default: false

    belongs_to :channel, Guilda.Channels.Channel
    belongs_to :author, Guilda.Accounts.User
    belongs_to :reply_to, Guilda.Messaging.Message
    has_many :reactions, Guilda.Messaging.Reaction
    has_many :attachments, Guilda.Messaging.Attachment

    timestamps(updated_at: false)
  end

  @required ~w(content channel_id author_id)a
  @optional ~w(reply_to_id edited_at deleted)a

  def changeset(message, attrs) do
    message
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_length(:content, min: 1, max: 4000)
    |> assoc_constraint(:channel)
    |> assoc_constraint(:author)
    |> assoc_constraint(:reply_to)
  end

  def edit_changeset(message, attrs) do
    message
    |> cast(attrs, [:content])
    |> validate_required([:content])
    |> validate_length(:content, min: 1, max: 4000)
    |> put_change(:edited_at, DateTime.utc_now() |> DateTime.truncate(:second))
  end
end
