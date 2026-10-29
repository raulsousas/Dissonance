defmodule Guilda.Messaging.Message do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "messages" do
    field :content, :string
    field :edited_at, :utc_datetime
    field :deleted, :boolean, default: false
    field :pinned, :boolean, default: false
    # "user" | "welcome". Not castable: only set by server code (see Messaging).
    field :kind, :string, default: "user"

    belongs_to :channel, Guilda.Channels.Channel
    belongs_to :author, Guilda.Accounts.User
    belongs_to :reply_to, Guilda.Messaging.Message
    has_many :reactions, Guilda.Messaging.Reaction
    has_many :attachments, Guilda.Messaging.Attachment

    timestamps(updated_at: false)
  end

  @required ~w(channel_id author_id)a
  @optional ~w(content reply_to_id edited_at deleted pinned)a

  def changeset(message, attrs) do
    message
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_content_or_attachments(attrs)
    |> assoc_constraint(:channel)
    |> assoc_constraint(:author)
    |> assoc_constraint(:reply_to)
  end

  defp validate_content_or_attachments(changeset, attrs) do
    content = get_field(changeset, :content)
    attachments = Map.get(attrs, :attachments) || Map.get(attrs, "attachments") || []

    has_content = content && String.trim(content) != ""
    has_attachments = is_list(attachments) && length(attachments) > 0

    cond do
      has_content ->
        validate_length(changeset, :content, min: 1, max: 4000)

      has_attachments ->
        changeset

      true ->
        validate_required(changeset, [:content])
    end
  end

  def edit_changeset(message, attrs) do
    message
    |> cast(attrs, [:content])
    |> validate_required([:content])
    |> validate_length(:content, min: 1, max: 4000)
    |> put_change(:edited_at, DateTime.utc_now() |> DateTime.truncate(:second))
  end

  def pin_changeset(message, pinned \\ true) do
    change(message, pinned: pinned)
  end
end
