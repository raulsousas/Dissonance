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
    Repo.all(
      from c in Category,
        where: c.server_id == ^server_id,
        order_by: c.position,
        preload: [channels: ^from(ch in Channel, order_by: ch.position)]
    )
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
    %Channel{}
    |> Channel.changeset(Map.put(attrs, :server_id, server.id))
    |> Repo.insert()
  end

  def update_channel(%Channel{} = channel, attrs) do
    channel |> Channel.changeset(attrs) |> Repo.update()
  end

  def delete_channel(%Channel{} = channel), do: Repo.delete(channel)
end
