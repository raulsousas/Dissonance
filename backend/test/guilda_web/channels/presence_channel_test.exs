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
end
