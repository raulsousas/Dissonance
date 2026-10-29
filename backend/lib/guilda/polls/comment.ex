defmodule Guilda.Polls.Comment do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "poll_comments" do
    field :text, :string

    belongs_to :poll, Guilda.Polls.Poll
    belongs_to :user, Guilda.Accounts.User

    timestamps(updated_at: false, type: :utc_datetime_usec)
  end

  def changeset(comment, attrs) do
    comment
    |> cast(attrs, [:text, :poll_id, :user_id])
    |> update_change(:text, &String.trim/1)
    |> validate_required([:text, :poll_id, :user_id])
    |> validate_length(:text, min: 1, max: 500)
  end
end
