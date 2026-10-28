defmodule Guilda.DirectMessagingTest do
  use Guilda.DataCase, async: true

  alias Guilda.Accounts.User
  alias Guilda.DirectMessaging

  defp insert_user(overrides \\ %{}) do
    attrs =
      %{
        email: "user_#{System.unique_integer([:positive])}@example.com",
        google_sub: "sub_#{System.unique_integer([:positive])}",
        display_name: "User #{System.unique_integer([:positive])}"
      }
      |> Map.merge(overrides)

    %User{}
    |> User.changeset(attrs)
    |> Repo.insert!()
  end

  describe "conversations" do
    test "get_or_create_conversation/2 returns existing or creates new conversation" do
      u1 = insert_user()
      u2 = insert_user()

      assert {:ok, conv1} = DirectMessaging.get_or_create_conversation(u1.id, u2.id)
      assert {:ok, conv2} = DirectMessaging.get_or_create_conversation(u2.id, u1.id)
      assert conv1.id == conv2.id
      assert DirectMessaging.member?(conv1.id, u1.id)
      assert DirectMessaging.member?(conv1.id, u2.id)
    end

    test "cannot create conversation with self" do
      u1 = insert_user()
      assert {:error, :cannot_message_self} = DirectMessaging.get_or_create_conversation(u1.id, u1.id)
    end

    test "list_conversations/1 lists conversations for a user" do
      u1 = insert_user()
      u2 = insert_user(%{display_name: "Bob"})

      {:ok, conv} = DirectMessaging.get_or_create_conversation(u1.id, u2.id)
      {:ok, _} = DirectMessaging.create_message(conv.id, u1, %{content: "Hello Bob!"})

      convs = DirectMessaging.list_conversations(u1)
      assert length(convs) == 1
      assert hd(convs).recipient.displayName == "Bob"
      assert hd(convs).lastMessage.content == "Hello Bob!"
    end
  end

  describe "messages" do
    test "create, list, edit, soft-delete direct messages" do
      u1 = insert_user()
      u2 = insert_user()

      {:ok, conv} = DirectMessaging.get_or_create_conversation(u1.id, u2.id)

      assert {:ok, msg} = DirectMessaging.create_message(conv.id, u1, %{content: "Hey there"})
      assert msg.content == "Hey there"

      res = DirectMessaging.list_messages(conv.id)
      assert length(res.messages) == 1

      assert {:ok, updated} = DirectMessaging.edit_message(msg, %{content: "Edited hey"})
      assert updated.content == "Edited hey"
      assert updated.edited_at != nil

      assert {:ok, deleted} = DirectMessaging.soft_delete_message(updated)
      assert deleted.deleted == true
      assert deleted.content == "[deleted]"
    end
  end
end
