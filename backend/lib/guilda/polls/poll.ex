defmodule Guilda.Polls.Poll do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "polls" do
    field :scope, :string
    field :channel_id, :binary_id
    field :title, :string
    field :allow_suggestions, :boolean, default: false
    field :multiple_choice, :boolean, default: false
    field :allow_comments, :boolean, default: true
    field :expires_at, :utc_datetime
    field :closed, :boolean, default: false

    belongs_to :author, Guilda.Accounts.User
    has_many :options, Guilda.Polls.Option, preload_order: [asc: :position, asc: :inserted_at]
    has_many :votes, Guilda.Polls.Vote
    has_many :comments, Guilda.Polls.Comment, preload_order: [asc: :inserted_at]

    timestamps(updated_at: false)
  end

  @required ~w(scope channel_id author_id title)a
  @optional ~w(allow_suggestions multiple_choice allow_comments expires_at)a

  def changeset(poll, attrs) do
    poll
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> update_change(:title, &String.trim/1)
    |> validate_length(:title, min: 1, max: 200)
    |> validate_inclusion(:scope, ["channel", "dm"])
    |> assoc_constraint(:author)
  end

  def closed_changeset(poll, closed), do: change(poll, closed: closed)
end
