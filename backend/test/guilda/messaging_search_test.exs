defmodule Guilda.MessagingSearchTest do
  use Guilda.DataCase, async: true

  alias Guilda.Accounts.User
  alias Guilda.{Channels, Messaging, Servers}

  defp insert_user(name) do
    n = System.unique_integer([:positive])

    %User{}
    |> User.changeset(%{
      email: "search_#{n}@example.com",
      google_sub: "search_sub_#{n}",
      display_name: name
    })
    |> Repo.insert!()
  end

  defp setup_server(owner) do
    {:ok, server} = Servers.create_server(owner, %{name: "Search Server"})
    {server, hd(Channels.list_channels(server))}
  end

  # `inserted_at` has second precision and ties are broken by random UUIDs, so
  # give every message its own second to keep ordering assertions deterministic.
  defp post(channel, author, content, attachments \\ []) do
    {:ok, message} =
      Messaging.create_message(%{
        content: content,
        channel_id: channel.id,
        author_id: author.id,
        attachments: attachments
      })

    tick = System.unique_integer([:positive, :monotonic])

    at =
      DateTime.utc_now()
      |> DateTime.add(tick, :second)
      |> DateTime.truncate(:second)
      |> DateTime.to_naive()

    message |> Ecto.Changeset.change(inserted_at: at) |> Repo.update!()
  end

  defp contents(%{results: results}), do: Enum.map(results, fn {m, _name} -> m.content end)

  describe "search_messages/2" do
    setup do
      ana = insert_user("Ana Souza")
      bruno = insert_user("Bruno Lima")
      {server, channel} = setup_server(ana)

      %{ana: ana, bruno: bruno, server: server, channel: channel}
    end

    test "returns nothing without any criteria", %{server: server, channel: channel, ana: ana} do
      post(channel, ana, "hello")
      assert %{results: [], has_more: false} = Messaging.search_messages(server.id, [])
      assert %{results: []} = Messaging.search_messages(server.id, text: "   ")
    end

    test "matches text case-insensitively, newest first, with the channel name",
         %{server: server, channel: channel, ana: ana} do
      post(channel, ana, "Deploy da API amanhã")
      post(channel, ana, "outra coisa")
      post(channel, ana, "o deploy falhou")

      result = Messaging.search_messages(server.id, text: "DEPLOY")

      assert contents(result) == ["o deploy falhou", "Deploy da API amanhã"]
      assert [{_, "general"} | _] = result.results
    end

    test "treats % and _ as literal characters", %{server: server, channel: channel, ana: ana} do
      post(channel, ana, "100% pronto")
      post(channel, ana, "1000 pronto")
      post(channel, ana, "snake_case")
      post(channel, ana, "snakeXcase")

      assert contents(Messaging.search_messages(server.id, text: "100%")) == ["100% pronto"]
      assert contents(Messaging.search_messages(server.id, text: "snake_case")) == ["snake_case"]
    end

    test "is safe against SQL-looking input", %{server: server, channel: channel, ana: ana} do
      post(channel, ana, "normal")
      result = Messaging.search_messages(server.id, text: "'; DROP TABLE messages; --")
      assert result.results == []
      assert contents(Messaging.search_messages(server.id, text: "normal")) == ["normal"]
    end

    test "filters by author name", %{server: server, channel: channel, ana: ana, bruno: bruno} do
      post(channel, ana, "msg da ana")
      post(channel, bruno, "msg do bruno")

      assert contents(Messaging.search_messages(server.id, from: "bru")) == ["msg do bruno"]
      assert contents(Messaging.search_messages(server.id, from: "souza", text: "msg")) == ["msg da ana"]
    end

    test "has: link only matches messages with URLs", %{server: server, channel: channel, ana: ana} do
      post(channel, ana, "veja https://example.com/doc")
      post(channel, ana, "olha www.exemplo.com")
      post(channel, ana, "sem link aqui")

      assert Enum.sort(contents(Messaging.search_messages(server.id, has: "link"))) ==
               ["olha www.exemplo.com", "veja https://example.com/doc"]
    end

    test "has: attachment / image use the attachments table",
         %{server: server, channel: channel, ana: ana} do
      att = fn type, name ->
        %{url: "https://cdn.test/#{name}", filename: name, size: 10, content_type: type}
      end

      post(channel, ana, "foto", [att.("image/png", "a.png")])
      post(channel, ana, "documento", [att.("application/pdf", "b.pdf")])
      post(channel, ana, "só texto")

      assert Enum.sort(contents(Messaging.search_messages(server.id, has: "attachment"))) ==
               ["documento", "foto"]

      assert contents(Messaging.search_messages(server.id, has: "image")) == ["foto"]
    end

    test "filters pinned messages", %{server: server, channel: channel, ana: ana} do
      pinned = post(channel, ana, "importante")
      post(channel, ana, "comum")
      pinned |> Ecto.Changeset.change(pinned: true) |> Repo.update!()

      assert contents(Messaging.search_messages(server.id, pinned: true)) == ["importante"]
    end

    test "excludes deleted messages and other servers",
         %{server: server, channel: channel, ana: ana} do
      deleted = post(channel, ana, "segredo apagado")
      deleted |> Ecto.Changeset.change(deleted: true) |> Repo.update!()

      other_owner = insert_user("Carla")
      {_other_server, other_channel} = setup_server(other_owner)
      post(other_channel, other_owner, "segredo de outro servidor")

      assert Messaging.search_messages(server.id, text: "segredo").results == []
    end

    test "restricts to one channel and ignores malformed channel ids",
         %{server: server, channel: channel, ana: ana} do
      {:ok, second} = Channels.create_channel(server, %{name: "random", type: "text"})
      post(channel, ana, "alfa no geral")
      post(second, ana, "alfa no random")

      assert contents(Messaging.search_messages(server.id, text: "alfa", channel_id: second.id)) ==
               ["alfa no random"]

      assert Messaging.search_messages(server.id, text: "alfa", channel_id: "nope").results == []
    end

    test "skips voice channels", %{server: server, ana: ana} do
      {:ok, voice} = Channels.create_channel(server, %{name: "voz", type: "voice"})
      post(voice, ana, "texto em canal de voz")

      assert Messaging.search_messages(server.id, text: "texto").results == []
    end

    test "paginates with a cursor and reports has_more",
         %{server: server, channel: channel, ana: ana} do
      for i <- 1..5, do: post(channel, ana, "item #{i}")

      first = Messaging.search_messages(server.id, text: "item", limit: 2)
      assert contents(first) == ["item 5", "item 4"]
      assert first.has_more

      {last, _} = List.last(first.results)
      second = Messaging.search_messages(server.id, text: "item", limit: 2, before_id: last.id)
      assert contents(second) == ["item 3", "item 2"]
      assert second.has_more

      {last, _} = List.last(second.results)
      third = Messaging.search_messages(server.id, text: "item", limit: 2, before_id: last.id)
      assert contents(third) == ["item 1"]
      refute third.has_more
    end

    test "caps the limit at 50", %{server: server, channel: channel, ana: ana} do
      for i <- 1..3, do: post(channel, ana, "x #{i}")
      assert length(Messaging.search_messages(server.id, text: "x", limit: 1000).results) == 3
    end
  end
end
