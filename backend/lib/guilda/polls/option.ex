defmodule Guilda.Polls.Option do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "poll_options" do
    field :text, :string
    field :position, :integer, default: 0

    belongs_to :poll, Guilda.Polls.Poll
    belongs_to :suggested_by, Guilda.Accounts.User

    timestamps(updated_at: false)
  end

  def changeset(option, attrs) do
    option
    |> cast(attrs, [:text, :position, :poll_id, :suggested_by_id])
    |> update_change(:text, &String.trim/1)
    |> validate_required([:text, :poll_id])
    |> validate_length(:text, min: 1, max: 100)
    |> assoc_constraint(:poll)
  end
end
