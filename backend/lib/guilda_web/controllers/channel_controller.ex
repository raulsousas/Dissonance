defmodule GuildaWeb.ChannelController do
  use GuildaWeb, :controller

  alias Guilda.{Channels, Servers}
  alias Guilda.Servers.Permissions

  plug GuildaWeb.ServerMemberPlug

  # GET /api/servers/:server_id/channels
  def index(conn, _params) do
    categories = Channels.list_categories(conn.assigns.server)
    json(conn, %{data: Enum.map(categories, &serialize_category/1)})
  end

  # POST /api/servers/:server_id/channels
  def create(conn, params) do
    with :ok <- require_permission(conn, Permissions.manage_channels()),
         attrs <- %{
           name: params["name"],
           type: params["type"] || "text",
           topic: params["topic"],
           category_id: params["category_id"],
           position: params["position"] || 0
         },
         {:ok, channel} <- Channels.create_channel(conn.assigns.server, attrs) do
      conn |> put_status(:created) |> json(%{data: serialize_channel(channel)})
    else
      {:error, :forbidden} ->
        conn |> put_status(:forbidden) |> json(%{error: "insufficient permissions"})
      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
    end
  end

  # PATCH /api/servers/:server_id/channels/:id
  def update(conn, %{"id" => id} = params) do
    with :ok <- require_permission(conn, Permissions.manage_channels()),
         channel when not is_nil(channel) <- Channels.get_channel(id),
         true <- channel.server_id == conn.assigns.server.id,
         attrs <- Map.take(params, ["name", "topic", "position", "category_id", "slowmode_seconds"]),
         {:ok, updated} <- Channels.update_channel(channel, attrs) do
      json(conn, %{data: serialize_channel(updated)})
    else
      {:error, :forbidden} ->
        conn |> put_status(:forbidden) |> json(%{error: "insufficient permissions"})
      nil -> conn |> put_status(:not_found) |> json(%{error: "channel not found"})
      false -> conn |> put_status(:not_found) |> json(%{error: "channel not found"})
      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
    end
  end

  # DELETE /api/servers/:server_id/channels/:id
  def delete(conn, %{"id" => id}) do
    with :ok <- require_permission(conn, Permissions.manage_channels()),
         channel when not is_nil(channel) <- Channels.get_channel(id),
         true <- channel.server_id == conn.assigns.server.id do
      Channels.delete_channel(channel)
      send_resp(conn, :no_content, "")
    else
      {:error, :forbidden} ->
        conn |> put_status(:forbidden) |> json(%{error: "insufficient permissions"})
      _ -> conn |> put_status(:not_found) |> json(%{error: "channel not found"})
    end
  end

  # POST /api/servers/:server_id/categories
  def create_category(conn, params) do
    with :ok <- require_permission(conn, Permissions.manage_channels()),
         {:ok, cat} <- Channels.create_category(conn.assigns.server, %{name: params["name"], position: params["position"] || 0}) do
      conn |> put_status(:created) |> json(%{data: serialize_category(cat)})
    else
      {:error, :forbidden} ->
        conn |> put_status(:forbidden) |> json(%{error: "insufficient permissions"})
      {:error, cs} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
    end
  end

  # ---------------------------------------------------------------------------
  # Serializers
  # ---------------------------------------------------------------------------

  defp serialize_category(c) do
    %{
      id: c.id,
      name: c.name,
      position: c.position,
      channels: if(Ecto.assoc_loaded?(c.channels), do: Enum.map(c.channels, &serialize_channel/1), else: [])
    }
  end

  defp serialize_channel(c) do
    %{id: c.id, name: c.name, type: c.type, topic: c.topic, position: c.position, categoryId: c.category_id}
  end

  defp require_permission(conn, permission) do
    membership = conn.assigns.membership
    server = conn.assigns.server

    if conn.assigns.current_user.id == server.owner_id or
         Servers.has_permission?(membership, permission) do
      :ok
    else
      {:error, :forbidden}
    end
  end

  defp format_errors(cs), do: Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
end
