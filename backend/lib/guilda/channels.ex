defmodule Guilda.Channels do
  @moduledoc "The Channels context — categories and channels within servers."

  import Ecto.Query, warn: false

  alias Guilda.Repo
  alias Guilda.Servers.Server
  alias Guilda.Channels.{Category, Channel}

  # ---------------------------------------------------------------------------
  # Categories
  # ---------------------------------------------------------------------------

  def list_categories(%Server{id: server_id}) do
    categories =
      Repo.all(
        from c in Category,
          where: c.server_id == ^server_id,
          order_by: c.position,
          preload: [channels: ^from(ch in Channel, order_by: ch.position)]
      )

    uncategorized =
      Repo.all(
        from ch in Channel,
          where: ch.server_id == ^server_id and is_nil(ch.category_id),
          order_by: ch.position
      )

    case {categories, uncategorized} do
      {[], []} ->
        []

      {cats, []} ->
        cats

      {[], uncat} ->
        [%Category{id: "default", name: "General", position: 0, channels: uncat}]

      {[first | rest], uncat} ->
        [%{first | channels: uncat ++ first.channels} | rest]
    end
  end

  def get_category(id), do: Repo.get(Category, id)

  def create_category(%Server{} = server, attrs) do
    %Category{}
    |> Category.changeset(Map.put(attrs, :server_id, server.id))
    |> Repo.insert()
  end

  def update_category(%Category{} = cat, attrs) do
    cat |> Category.changeset(attrs) |> Repo.update()
  end

  def delete_category(%Category{} = cat), do: Repo.delete(cat)

  # ---------------------------------------------------------------------------
  # Channels
  # ---------------------------------------------------------------------------

  def list_channels(%Server{id: server_id}) do
    Repo.all(from c in Channel, where: c.server_id == ^server_id, order_by: c.position)
  end

  def get_channel(id), do: Repo.get(Channel, id)

  def get_channel_with_server(id) do
    Repo.one(from c in Channel, where: c.id == ^id, preload: [:server])
  end

  def create_channel(%Server{} = server, attrs) do
    category_id =
      attrs[:category_id] || attrs["category_id"] || attrs["categoryId"] ||
        get_or_create_default_category_id(server)

    attrs =
      attrs
      |> Map.put(:server_id, server.id)
      |> Map.put(:category_id, category_id)

    %Channel{}
    |> Channel.changeset(attrs)
    |> Repo.insert()
  end

  defp get_or_create_default_category_id(%Server{id: server_id} = server) do
    case Repo.one(from c in Category, where: c.server_id == ^server_id, order_by: c.position, limit: 1) do
      %Category{id: id} ->
        id

      nil ->
        case create_category(server, %{name: "General", position: 0}) do
          {:ok, %Category{id: id}} -> id
          _ -> nil
        end
    end
  end

  def update_channel(%Channel{} = channel, attrs) do
    channel |> Channel.changeset(attrs) |> Repo.update()
  end

  def delete_channel(%Channel{} = channel), do: Repo.delete(channel)
end
