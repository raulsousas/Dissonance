defmodule Guilda.RemindersTest do
  use Guilda.DataCase, async: true

  alias Guilda.Accounts.User
  alias Guilda.{Channels, DirectMessaging, Messaging, Reminders, Servers}

  defp insert_user do
    n = System.unique_integer([:positive])

    %User{}
    |> User.changeset(%{
      email: "rem_user_#{n}@example.com",
      google_sub: "rem_sub_#{n}",
      display_name: "Rem User #{n}"
    })
    |> Repo.insert!()
  end

  defp channel_message(owner, content \\ "Não esquecer do deploy") do
    {:ok, server} = Servers.create_server(owner, %{name: "Rem Server"})
    channel = hd(Channels.list_channels(server))

    {:ok, message} =
      Messaging.create_message(%{content: content, channel_id: channel.id, author_id: owner.id})

    {server, channel, message}
  end

  defp in_seconds(seconds) do
    DateTime.utc_now() |> DateTime.add(seconds, :second) |> DateTime.to_iso8601()
  end

  defp attrs(message, overrides \\ %{}) do
    Map.merge(
      %{"scope" => "channel", "message_id" => message.id, "remind_at" => in_seconds(3600)},
      overrides
    )
  end

  describe "create_reminder/3" do
    test "snapshots the message for a channel member" do
      owner = insert_user()
      {_server, channel, message} = channel_message(owner)

      assert {:ok, reminder} = Reminders.create_reminder(owner, attrs(message))
      assert reminder.preview == "Não esquecer do deploy"
      assert reminder.channel_id == channel.id
      assert reminder.author_name == owner.display_name
      assert reminder.scope == "channel"
      assert is_nil(reminder.notified_at)
    end

    test "works for direct messages between members only" do
      a = insert_user()
      b = insert_user()
      outsider = insert_user()
      {:ok, conv} = DirectMessaging.get_or_create_conversation(a.id, b.id)
      {:ok, dm} = DirectMessaging.create_message(conv.id, a, %{content: "Oi!"})

      dm_attrs = %{"scope" => "dm", "message_id" => dm.id, "remind_at" => in_seconds(600)}

      assert {:ok, reminder} = Reminders.create_reminder(b, dm_attrs)
      assert reminder.channel_id == conv.id
      assert reminder.server_id == nil
      assert {:error, :forbidden} = Reminders.create_reminder(outsider, dm_attrs)
    end

    test "rejects users who cannot see the message" do
      owner = insert_user()
      outsider = insert_user()
      {_server, _channel, message} = channel_message(owner)

      assert {:error, :forbidden} = Reminders.create_reminder(outsider, attrs(message))
    end

    test "rejects unknown, malformed and deleted messages" do
      owner = insert_user()
      {_server, _channel, message} = channel_message(owner)

      assert {:error, :not_found} =
               Reminders.create_reminder(owner, attrs(message, %{"message_id" => Ecto.UUID.generate()}))

      assert {:error, :not_found} =
               Reminders.create_reminder(owner, attrs(message, %{"message_id" => "nope"}))

      assert {:error, :not_found} =
               Reminders.create_reminder(owner, attrs(message, %{"scope" => "other"}))

      message |> Ecto.Changeset.change(deleted: true) |> Repo.update!()
      assert {:error, :not_found} = Reminders.create_reminder(owner, attrs(message))
    end

    test "validates the reminder time" do
      owner = insert_user()
      {_server, _channel, message} = channel_message(owner)

      for bad <- [nil, "tomorrow", in_seconds(-60), in_seconds(5), in_seconds(60 * 60 * 24 * 400)] do
        assert {:error, :invalid_time} =
                 Reminders.create_reminder(owner, attrs(message, %{"remind_at" => bad}))
      end
    end

    test "limits pending reminders per user" do
      owner = insert_user()
      {_server, _channel, message} = channel_message(owner)

      for _ <- 1..50, do: {:ok, _} = Reminders.create_reminder(owner, attrs(message))
      assert {:error, :too_many} = Reminders.create_reminder(owner, attrs(message))
    end

    test "uses a placeholder preview for attachment-only messages" do
      owner = insert_user()
      {_server, _channel, message} = channel_message(owner)
      message |> Ecto.Changeset.change(content: nil) |> Repo.update!()

      assert {:ok, reminder} = Reminders.create_reminder(owner, attrs(message))
      assert reminder.preview == "(anexo)"
    end
  end

  describe "claim_due/1" do
    test "claims only due reminders, exactly once" do
      owner = insert_user()
      {_server, _channel, message} = channel_message(owner)

      {:ok, due} = Reminders.create_reminder(owner, attrs(message, %{"remind_at" => in_seconds(60)}))
      {:ok, later} = Reminders.create_reminder(owner, attrs(message, %{"remind_at" => in_seconds(7200)}))

      now = DateTime.add(DateTime.utc_now(), 120, :second)

      assert [claimed] = Reminders.claim_due(now)
      assert claimed.id == due.id
      assert claimed.notified_at
      assert Reminders.claim_due(now) == []

      pending = Reminders.list_pending(owner)
      assert Enum.map(pending, & &1.id) == [due.id, later.id]
      assert Reminders.serialize(hd(pending)).due == true
      assert Reminders.serialize(List.last(pending)).due == false
    end

    test "notify/1 broadcasts reminder_due on the owner's personal topic" do
      owner = insert_user()
      {_server, _channel, message} = channel_message(owner)
      {:ok, reminder} = Reminders.create_reminder(owner, attrs(message))

      GuildaWeb.Endpoint.subscribe("user:#{owner.id}")
      Reminders.notify(reminder)

      assert_receive %Phoenix.Socket.Broadcast{
        event: "reminder_due",
        payload: %{id: id, preview: "Não esquecer do deploy"}
      }

      assert id == reminder.id
    end
  end

  describe "delete_reminder/2" do
    test "only the owner can delete, unknown ids return not_found" do
      owner = insert_user()
      other = insert_user()
      {_server, _channel, message} = channel_message(owner)
      {:ok, reminder} = Reminders.create_reminder(owner, attrs(message))

      assert {:error, :not_found} = Reminders.delete_reminder(other, reminder.id)
      assert {:error, :not_found} = Reminders.delete_reminder(owner, "nope")
      assert {:ok, _} = Reminders.delete_reminder(owner, reminder.id)
      assert Reminders.list_pending(owner) == []
    end

    test "list_pending/1 is scoped to the user" do
      owner = insert_user()
      other = insert_user()
      {_server, _channel, message} = channel_message(owner)
      {:ok, _} = Reminders.create_reminder(owner, attrs(message))

      assert length(Reminders.list_pending(owner)) == 1
      assert Reminders.list_pending(other) == []
    end
  end
end
