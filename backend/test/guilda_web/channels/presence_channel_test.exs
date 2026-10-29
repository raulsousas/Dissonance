defmodule GuildaWeb.PresenceChannelTest do
  use ExUnit.Case, async: false

  import Phoenix.ChannelTest
  alias Guilda.Repo
  alias Guilda.Accounts
  alias Guilda.Accounts.User
  alias GuildaWeb.UserSocket

  @endpoint GuildaWeb.Endpoint

  setup do
    :ok = Ecto.Adapters.SQL.Sandbox.checkout(Repo)
    Ecto.Adapters.SQL.Sandbox.mode(Repo, {:shared, self()})
    :ok
  end

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

  test "authenticated user can join presence:global and receives presence_state" do
    user = insert_user()
    {:ok, {token, _session}} = Accounts.create_session(user)

    {:ok, socket} = connect(UserSocket, %{"token" => token})
    assert {:ok, _reply, socket} = subscribe_and_join(socket, "presence:global", %{})

    assert socket.assigns.current_user.id == user.id
    assert_push "presence_state", %{}
  end

  test "unauthenticated socket cannot join presence:global" do
    {:ok, socket} = connect(UserSocket, %{})
    assert {:error, %{reason: "unauthenticated"}} =
             subscribe_and_join(socket, "presence:global", %{})
  end

  test "update_status updates user status" do
    user = insert_user()
    {:ok, {token, _session}} = Accounts.create_session(user)

    {:ok, socket} = connect(UserSocket, %{"token" => token})
    {:ok, _reply, socket} = subscribe_and_join(socket, "presence:global", %{})

    ref = push(socket, "update_status", %{"status" => "dnd"})
    assert_reply ref, :ok
  end

  describe "update_voice_channel" do
    setup do
      user = insert_user()
      {:ok, {token, _session}} = Accounts.create_session(user)
      {:ok, socket} = connect(UserSocket, %{"token" => token})
      {:ok, _reply, socket} = subscribe_and_join(socket, "presence:global", %{})
      # Let :after_join finish tracking the user before updating its metadata.
      assert_push "presence_state", %{}
      {:ok, socket: socket, user: user}
    end

    defp voice_meta(user) do
      GuildaWeb.Presence.get_by_key("presence:global", user.id).metas |> hd()
    end

    test "publishes mute, deafen and sharing state", %{socket: socket, user: user} do
      channel_id = Ecto.UUID.generate()

      ref =
        push(socket, "update_voice_channel", %{
          "voice_channel_id" => channel_id,
          "is_muted" => true,
          "is_deafened" => false,
          "is_sharing" => true
        })

      assert_reply ref, :ok
      meta = voice_meta(user)

      assert meta.voice_channel_id == channel_id
      assert meta.voice_muted == true
      assert meta.voice_deafened == false
      assert meta.voice_sharing == true
    end

    test "sharing is cleared when leaving the voice channel", %{socket: socket, user: user} do
      push(socket, "update_voice_channel", %{
        "voice_channel_id" => Ecto.UUID.generate(),
        "is_sharing" => true
      })

      ref =
        push(socket, "update_voice_channel", %{
          "voice_channel_id" => nil,
          "is_sharing" => true
        })

      assert_reply ref, :ok
      meta = voice_meta(user)

      assert meta.voice_channel_id == nil
      assert meta.voice_sharing == false
    end

    test "only literal booleans are accepted as state", %{socket: socket, user: user} do
      ref =
        push(socket, "update_voice_channel", %{
          "voice_channel_id" => Ecto.UUID.generate(),
          "is_muted" => "true",
          "is_sharing" => "yes"
        })

      assert_reply ref, :ok
      meta = voice_meta(user)

      assert meta.voice_muted == false
      assert meta.voice_sharing == false
    end
  end
end
