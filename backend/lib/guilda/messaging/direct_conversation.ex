defmodule Guilda.Messaging.DirectConversation do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "direct_conversations" do
    has_many :direct_messages, Guilda.Messaging.DirectMessage, foreign_key: :conversation_id
    many_to_many :participants, Guilda.Accounts.User,
      join_through: "direct_conversation_members",
      join_keys: [conversation_id: :id, user_id: :id]

    timestamps(updated_at: false)
  end

  def changeset(conversation, attrs) do
    conversation
    |> cast(attrs, [])
  end
end
