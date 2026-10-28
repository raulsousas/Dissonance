defmodule Guilda.VoiceTest do
  use Guilda.DataCase, async: true

  alias Guilda.Accounts.User
  alias Guilda.Servers
  alias Guilda.Channels
  alias Guilda.Voice

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

  describe "issue_token/2" do
    test "issues token for server owner in a voice channel" do
      owner = insert_user()
      {:ok, server} = Servers.create_server(owner, %{name: "Voice Server"})
      {:ok, channel} = Channels.create_channel(server, %{name: "Lounge", type: "voice"})

      assert {:ok, res} = Voice.issue_token(channel.id, owner)
      assert is_binary(res.token)
      assert res.room == channel.id
      assert res.canSpeak == true
    end

    test "returns error for text channel" do
      owner = insert_user()
      {:ok, server} = Servers.create_server(owner, %{name: "Text Server"})
      {:ok, channel} = Channels.create_channel(server, %{name: "general", type: "text"})

      assert {:error, :not_a_voice_channel} = Voice.issue_token(channel.id, owner)
    end

    test "returns error for non-member" do
      owner = insert_user()
      non_member = insert_user()
      {:ok, server} = Servers.create_server(owner, %{name: "Voice Server"})
      {:ok, channel} = Channels.create_channel(server, %{name: "Lounge", type: "voice"})

      assert {:error, :not_a_member} = Voice.issue_token(channel.id, non_member)
    end
  end
end
