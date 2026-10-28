defmodule Guilda.DirectMessaging.ConversationMember do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key false
  schema "direct_conversation_members" do
    belongs_to :conversation, Guilda.DirectMessaging.Conversation,
      primary_key: true,
      type: :binary_id

    belongs_to :user, Guilda.Accounts.User, primary_key: true, type: :binary_id
  end

  def changeset(member, attrs) do
    member
    |> cast(attrs, [:conversation_id, :user_id])
    |> validate_required([:conversation_id, :user_id])
    |> unique_constraint([:conversation_id, :user_id],
      name: :direct_conversation_members_conversation_id_user_id_index
    )
  end
end
