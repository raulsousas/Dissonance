defmodule Guilda.DirectMessaging.DirectMessage do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "direct_messages" do
    field :content, :string
    field :attachments, {:array, :map}, default: []
    field :edited_at, :utc_datetime
    field :deleted, :boolean, default: false
    field :pinned, :boolean, default: false

    belongs_to :conversation, Guilda.DirectMessaging.Conversation
    belongs_to :author, Guilda.Accounts.User

    timestamps(updated_at: false)
  end

  @required ~w(conversation_id author_id)a
  @optional ~w(content attachments edited_at deleted pinned)a

  def changeset(message, attrs) do
    message
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_content_or_attachments(attrs)
  end

  defp validate_content_or_attachments(changeset, attrs) do
    content = get_field(changeset, :content)
    attachments = Map.get(attrs, :attachments) || Map.get(attrs, "attachments") || get_field(changeset, :attachments) || []

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

  def pin_changeset(message, pinned \\ true) do
    change(message, pinned: pinned)
  end
end
