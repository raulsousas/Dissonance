defmodule Guilda.FocusModeTest do
  use Guilda.DataCase, async: true

  alias Guilda.Accounts.User
  alias Guilda.{Channels, FocusMode, Messaging, Servers}

  defp insert_user(name) do
    n = System.unique_integer([:positive])

    %User{}
    |> User.changeset(%{
      email: "focus_#{n}@example.com",
      google_sub: "focus_sub_#{n}",
      display_name: name
    })
    |> Repo.insert!()
  end

  defp setup_server(owner) do
    {:ok, server} = Servers.create_server(owner, %{name: "Focus Server"})
    {server, hd(Channels.list_channels(server))}
  end

  defp join(server, user) do
    {:ok, _} = Servers.add_member(server, user)
    :ok
  end

  defp post(channel, author, content) do
    {:ok, message} =
      Messaging.create_message(%{content: content, channel_id: channel.id, author_id: author.id})

    message
  end

  # Make "muted_at" old enough that messages created now are "after" it.
  defp mute_in_the_past(user, channel) do
    {:ok, _} = FocusMode.mute(user, channel.id)
    past = DateTime.utc_now() |> DateTime.add(-3600, :second) |> DateTime.truncate(:second)

    Repo.update_all(
      from(m in Guilda.FocusMode.ChannelMute,
        where: m.user_id == ^user.id and m.channel_id == ^channel.id
      ),
      set: [muted_at: past]
    )
  end

  setup do
    ana = insert_user("Ana")
    bruno = insert_user("Bruno")
    carla = insert_user("Carla")
    {server, channel} = setup_server(ana)
    join(server, bruno)
    join(server, carla)

    %{ana: ana, bruno: bruno, carla: carla, server: server, channel: channel}
  end

  describe "mute/unmute" do
    test "mutes idempotently and lists only the caller's mutes", ctx do
      assert {:ok, %DateTime{}} = FocusMode.mute(ctx.bruno, ctx.channel.id)
      assert {:ok, %DateTime{}} = FocusMode.mute(ctx.bruno, ctx.channel.id)

      assert [%{channel_id: id}] = FocusMode.list_muted(ctx.bruno)
      assert id == ctx.channel.id
      assert FocusMode.list_muted(ctx.carla) == []
    end

    test "unmute removes the mute and is idempotent", ctx do
      {:ok, _} = FocusMode.mute(ctx.bruno, ctx.channel.id)
      assert :ok = FocusMode.unmute(ctx.bruno, ctx.channel.id)
      assert :ok = FocusMode.unmute(ctx.bruno, ctx.channel.id)
      assert FocusMode.list_muted(ctx.bruno) == []
    end

    test "unmute with garbage id does not crash", ctx do
      assert :ok = FocusMode.unmute(ctx.bruno, "not-a-uuid")
    end

    test "a non-member cannot mute (and learns nothing)", ctx do
      outsider = insert_user("Outsider")
      assert {:error, :not_found} = FocusMode.mute(outsider, ctx.channel.id)
      assert {:error, :not_found} = FocusMode.mute(outsider, Ecto.UUID.generate())
      assert {:error, :not_found} = FocusMode.mute(outsider, "nope")
    end

    test "reject_muted removes only users who muted that channel", ctx do
      {:ok, _} = FocusMode.mute(ctx.bruno, ctx.channel.id)
      other = Channels.list_channels(ctx.server) |> hd()

      assert FocusMode.reject_muted([ctx.bruno.id, ctx.carla.id], ctx.channel.id) == [ctx.carla.id]
      assert FocusMode.reject_muted([], ctx.channel.id) == []
      assert other.id == ctx.channel.id
    end
  end

  describe "summary/2" do
    test "is not available unless the channel is muted", ctx do
      assert {:error, :not_found} = FocusMode.summary(ctx.bruno, ctx.channel.id)
    end

    test "is not available to non-members", ctx do
      outsider = insert_user("Outsider")
      assert {:error, :not_found} = FocusMode.summary(outsider, ctx.channel.id)
    end

    test "counts messages from others, ranks authors, extracts links and mentions", ctx do
      mute_in_the_past(ctx.bruno, ctx.channel)

      post(ctx.channel, ctx.ana, "bom dia")
      post(ctx.channel, ctx.ana, "veja https://example.com/a, e https://example.com/b.")
      post(ctx.channel, ctx.carla, "oi @Bruno você viu?")
      post(ctx.channel, ctx.carla, "aviso geral @everyone")
      # Own messages are not part of the summary.
      post(ctx.channel, ctx.bruno, "mensagem minha https://own.example.com")

      assert {:ok, summary} = FocusMode.summary(ctx.bruno, ctx.channel.id)

      assert summary.total == 4
      assert summary.truncated == false

      assert [%{authorName: "Ana", count: 2}, %{authorName: "Carla", count: 2}] = summary.authors

      urls = Enum.map(summary.links, & &1.url)
      assert urls == ["https://example.com/a", "https://example.com/b"]

      kinds = Enum.map(summary.mentions, & &1.kind) |> Enum.sort()
      assert kinds == ["everyone", "user"]
    end

    test "does not treat a longer name as a mention of the user", ctx do
      mute_in_the_past(ctx.bruno, ctx.channel)
      post(ctx.channel, ctx.ana, "falei com @Brunorama ontem")

      assert {:ok, %{mentions: []}} = FocusMode.summary(ctx.bruno, ctx.channel.id)
    end

    test "a display name with regex characters is matched literally", ctx do
      odd = insert_user("a.b+(c")
      join(ctx.server, odd)
      mute_in_the_past(odd, ctx.channel)

      post(ctx.channel, ctx.ana, "oi @aXb+(c")
      post(ctx.channel, ctx.ana, "oi @a.b+(c !")

      assert {:ok, %{mentions: [%{kind: "user"}]}} = FocusMode.summary(odd, ctx.channel.id)
    end

    test "ignores deleted messages", ctx do
      mute_in_the_past(ctx.bruno, ctx.channel)
      msg = post(ctx.channel, ctx.ana, "apagada")
      {:ok, _} = Messaging.soft_delete_message(msg)

      assert {:ok, %{total: 0}} = FocusMode.summary(ctx.bruno, ctx.channel.id)
    end

    test "starts from the last read position when it is newer than the mute", ctx do
      mute_in_the_past(ctx.bruno, ctx.channel)
      first = post(ctx.channel, ctx.ana, "antes de ler")

      Messaging.mark_read(ctx.channel.id, ctx.bruno.id, first.id)

      # Pretend the read happened in the future so the next message is "older".
      future = DateTime.utc_now() |> DateTime.add(3600, :second) |> DateTime.truncate(:second)

      Repo.update_all(
        from(r in Guilda.Messaging.ReadState,
          where: r.user_id == ^ctx.bruno.id and r.channel_id == ^ctx.channel.id
        ),
        set: [last_read_at: future]
      )

      post(ctx.channel, ctx.ana, "depois")
      assert {:ok, %{total: 0}} = FocusMode.summary(ctx.bruno, ctx.channel.id)
    end

    test "is isolated per user", ctx do
      mute_in_the_past(ctx.bruno, ctx.channel)
      post(ctx.channel, ctx.ana, "olá")

      assert {:ok, %{total: 1}} = FocusMode.summary(ctx.bruno, ctx.channel.id)
      assert {:error, :not_found} = FocusMode.summary(ctx.carla, ctx.channel.id)
    end
  end
end
