defmodule Guilda.Polls.Vote do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "poll_votes" do
    belongs_to :poll, Guilda.Polls.Poll
    belongs_to :option, Guilda.Polls.Option
    belongs_to :user, Guilda.Accounts.User

    timestamps(updated_at: false)
  end

  def changeset(vote, attrs) do
    vote
    |> cast(attrs, [:poll_id, :option_id, :user_id])
    |> validate_required([:poll_id, :option_id, :user_id])
    |> unique_constraint([:option_id, :user_id])
  end
end
