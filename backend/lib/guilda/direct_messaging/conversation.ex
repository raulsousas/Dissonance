defmodule Guilda.DirectMessaging.Conversation do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "direct_conversations" do
    has_many :members, Guilda.DirectMessaging.ConversationMember
    has_many :users, through: [:members, :user]
    has_many :messages, Guilda.DirectMessaging.DirectMessage

    timestamps(updated_at: false)
  end

  def changeset(conversation, attrs \\ %{}) do
    conversation
    |> cast(attrs, [])
  end
end
