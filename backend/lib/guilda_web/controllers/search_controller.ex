defmodule GuildaWeb.SearchController do
  @moduledoc """
  Server-side message search.

    GET /api/servers/:server_id/search
      ?q=text &from=author &has=link|attachment|image &pinned=true
      &channel_id=<uuid> &before=<message id> &limit=<1..50>
  """

  use GuildaWeb, :controller

  alias Guilda.{Messaging, Servers}

  @has_values ~w(link attachment image)

  def index(conn, %{"server_id" => server_id} = params) do
    user = conn.assigns.current_user

    with {:ok, _uuid} <- Ecto.UUID.cast(server_id),
         %Servers.Server{} = server <- Servers.get_server(server_id),
         true <- Servers.member?(server, user) do
      %{results: results, has_more: has_more} =
        Messaging.search_messages(server.id,
          text: params["q"],
          from: params["from"],
          has: if(params["has"] in @has_values, do: params["has"]),
          pinned: params["pinned"] == "true",
          channel_id: params["channel_id"],
          before_id: params["before"],
          limit: parse_limit(params["limit"])
        )

      json(conn, %{results: Enum.map(results, &serialize/1), has_more: has_more})
    else
      # Same answer for "no such server" and "not a member": do not leak existence.
      _ -> conn |> put_status(404) |> json(%{error: "server not found"})
    end
  end

  defp parse_limit(value) when is_binary(value) do
    case Integer.parse(value) do
      {n, ""} when n > 0 -> min(n, 50)
      _ -> 25
    end
  end

  defp parse_limit(_), do: 25

  defp serialize({message, channel_name}) do
    %{
      id: message.id,
      content: message.content,
      channelId: message.channel_id,
      channelName: channel_name,
      authorId: message.author_id,
      authorName: message.author && message.author.display_name,
      authorAvatar: message.author && message.author.avatar_url,
      pinned: message.pinned || false,
      attachmentCount: length(message.attachments),
      insertedAt: message.inserted_at
    }
  end
end
