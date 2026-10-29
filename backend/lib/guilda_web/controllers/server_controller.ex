defmodule GuildaWeb.ServerController do
  use GuildaWeb, :controller

  alias Guilda.{Servers, Channels}
  alias Guilda.Servers.Permissions

  # Apply ServerMemberPlug for all actions that need server membership
  plug GuildaWeb.ServerMemberPlug when action in [:update, :delete, :leave,
    :list_invites, :create_invite, :delete_invite]

  # GET /api/invites/:code (public — no auth)
  def preview_invite(conn, %{"code" => code}) do
    case Servers.get_invite_by_code(code) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "invite not found"})

      invite ->
        if Guilda.Servers.Invite.valid?(invite) do
          server = Servers.get_server(invite.server_id)
          json(conn, %{data: %{
            code: invite.code,
            serverName: server && server.name,
            serverIcon: server && server.icon_url,
            uses: invite.uses,
            maxUses: invite.max_uses,
            expiresAt: invite.expires_at
          }})
        else
          conn |> put_status(:gone) |> json(%{error: "invite expired or exhausted"})
        end
    end
  end

  # GET /api/servers
  def index(conn, _params) do
    servers = Servers.list_for_user(conn.assigns.current_user)
    json(conn, %{data: Enum.map(servers, &serialize_server/1)})
  end

  # POST /api/servers
  def create(conn, params) do
    attrs = %{
      name: params["name"],
      description: params["description"]
    }

    case Servers.create_server(conn.assigns.current_user, attrs) do
      {:ok, server} ->
        conn |> put_status(:created) |> json(%{data: serialize_server(server)})

      {:error, changeset} ->
        conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(changeset)})
    end
  end

  # GET /api/servers/:server_id
  def show(conn, %{"server_id" => id}) do
    case Servers.get_server_detail(id) do
      nil ->
        conn |> put_status(:not_found) |> json(%{error: "not found"})

      server ->
        if Servers.member?(server, conn.assigns.current_user) do
          members = Servers.list_members(server)
          categories = Channels.list_categories(server)
          json(conn, %{data: serialize_server_detail(server, members, categories)})
        else
          conn |> put_status(:forbidden) |> json(%{error: "not a member"})
        end
    end
  end

  # PATCH /api/servers/:server_id
  def update(conn, %{"server_id" => _id} = params) do
    server = conn.assigns.server
    membership = conn.assigns.membership

    unless is_owner?(server, conn.assigns.current_user) or
             Servers.has_permission?(membership, Permissions.manage_server()) do
      conn |> put_status(:forbidden) |> json(%{error: "insufficient permissions"}) |> halt()
    else
      attrs = Map.take(params, ["name", "description", "icon_url"])

      case Servers.update_server(server, attrs) do
        {:ok, updated} -> json(conn, %{data: serialize_server(updated)})
        {:error, cs} -> conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
      end
    end
  end

  # DELETE /api/servers/:server_id
  def delete(conn, %{"server_id" => _id, "confirm" => "true"}) do
    server = conn.assigns.server

    unless is_owner?(server, conn.assigns.current_user) do
      conn |> put_status(:forbidden) |> json(%{error: "only the owner can delete the server"}) |> halt()
    else
      case Servers.delete_server(server) do
        {:ok, _} -> send_resp(conn, :no_content, "")
        {:error, _} -> conn |> put_status(:unprocessable_entity) |> json(%{error: "could not delete server"})
      end
    end
  end

  def delete(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "pass confirm=true to delete"})
  end

  # POST /api/servers/join
  def join(conn, %{"code" => code}) do
    case Servers.consume_invite(code, conn.assigns.current_user) do
      {:ok, {server, _member}} ->
        post_welcome_message(server, conn.assigns.current_user)
        conn |> put_status(:ok) |> json(%{data: serialize_server(server)})

      {:error, :not_found} ->
        conn |> put_status(:not_found) |> json(%{error: "invite not found"})

      {:error, :expired} ->
        conn |> put_status(:gone) |> json(%{error: "invite expired or exhausted"})

      {:error, :already_member} ->
        conn |> put_status(:conflict) |> json(%{error: "already a member"})

      {:error, _} ->
        conn |> put_status(:unprocessable_entity) |> json(%{error: "could not join server"})
    end
  end

  def join(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "code is required"})
  end

  # Greets a new member in the server's first text channel. Best effort: a
  # failure here must never make the join itself fail. Only the channel topic is
  # notified (no per-member "new message" sound for every join).
  defp post_welcome_message(server, user) do
    case Guilda.Messaging.create_welcome_message(server, user) do
      {:ok, message} ->
        GuildaWeb.Endpoint.broadcast(
          "channel:#{message.channel_id}",
          "new_message",
          GuildaWeb.MessagesController.serialize_message(message)
        )

      {:error, reason} ->
        require Logger
        Logger.warning("[ServerController] Welcome message not posted reason=#{inspect(reason)}")
    end
  end

  # DELETE /api/servers/:server_id/members/me
  def leave(conn, _params) do
    server = conn.assigns.server
    user = conn.assigns.current_user

    if is_owner?(server, user) do
      conn |> put_status(:bad_request) |> json(%{error: "owner cannot leave; transfer ownership first"})
    else
      Servers.remove_member(server, user)
      send_resp(conn, :no_content, "")
    end
  end

  # GET /api/servers/:server_id/invites
  def list_invites(conn, _params) do
    server = conn.assigns.server
    membership = conn.assigns.membership

    unless is_owner?(server, conn.assigns.current_user) or
             Servers.has_permission?(membership, Permissions.manage_invites()) do
      conn |> put_status(:forbidden) |> json(%{error: "insufficient permissions"}) |> halt()
    else
      invites = Servers.list_invites(server)
      json(conn, %{data: Enum.map(invites, &serialize_invite/1)})
    end
  end

  # POST /api/servers/:server_id/invites
  def create_invite(conn, params) do
    server = conn.assigns.server
    membership = conn.assigns.membership

    unless is_owner?(server, conn.assigns.current_user) or
             Servers.has_permission?(membership, Permissions.manage_invites()) do
      conn |> put_status(:forbidden) |> json(%{error: "insufficient permissions"}) |> halt()
    else
      opts =
        []
        |> then(fn o -> if params["max_uses"], do: Keyword.put(o, :max_uses, params["max_uses"]), else: o end)
        |> then(fn o -> if params["expires_in_hours"], do: Keyword.put(o, :expires_in_hours, params["expires_in_hours"]), else: o end)

      case Servers.create_invite(server, conn.assigns.current_user, opts) do
        {:ok, invite} ->
          conn |> put_status(:created) |> json(%{data: serialize_invite(invite)})

        {:error, cs} ->
          conn |> put_status(:unprocessable_entity) |> json(%{errors: format_errors(cs)})
      end
    end
  end

  # DELETE /api/servers/:server_id/invites/:code
  def delete_invite(conn, %{"code" => code}) do
    server = conn.assigns.server
    membership = conn.assigns.membership

    unless is_owner?(server, conn.assigns.current_user) or
             Servers.has_permission?(membership, Permissions.manage_invites()) do
      conn |> put_status(:forbidden) |> json(%{error: "insufficient permissions"}) |> halt()
    else
      case Servers.get_invite_by_code(code) do
        nil -> conn |> put_status(:not_found) |> json(%{error: "not found"})
        invite ->
          Servers.revoke_invite(invite)
          send_resp(conn, :no_content, "")
      end
    end
  end

  # ---------------------------------------------------------------------------
  # Serializers
  # ---------------------------------------------------------------------------

  defp serialize_server(s) do
    %{
      id: s.id,
      name: s.name,
      description: s.description,
      iconUrl: s.icon_url,
      ownerId: s.owner_id
    }
  end

  defp serialize_server_detail(server, members, categories) do
    serialize_server(server)
    |> Map.merge(%{
      roles: Enum.map(server.roles, &serialize_role/1),
      categories: Enum.map(categories, &serialize_category/1),
      channels: Enum.map(server.channels, &serialize_channel/1),
      members: Enum.map(members, &serialize_member/1)
    })
  end

  defp serialize_role(r), do: %{id: r.id, name: r.name, permissions: r.permissions, position: r.position, isDefault: r.is_default}
  defp serialize_channel(c), do: %{id: c.id, name: c.name, type: c.type, topic: c.topic, position: c.position, categoryId: c.category_id}
  defp serialize_category(c), do: %{id: c.id, name: c.name, position: c.position, channels: Enum.map(c.channels, &serialize_channel/1)}
  defp serialize_member(sm), do: %{
    userId: sm.user_id,
    displayName: sm.user.display_name,
    avatarUrl: sm.user.avatar_url,
    role: sm.role && %{id: sm.role.id, name: sm.role.name}
  }
  defp serialize_invite(i), do: %{
    code: i.code,
    maxUses: i.max_uses,
    uses: i.uses,
    expiresAt: i.expires_at,
    createdBy: i.created_by
  }

  defp is_owner?(%{owner_id: owner_id}, %{id: user_id}), do: owner_id == user_id
  defp format_errors(cs), do: Ecto.Changeset.traverse_errors(cs, fn {msg, _} -> msg end)
end
