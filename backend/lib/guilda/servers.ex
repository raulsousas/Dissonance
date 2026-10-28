defmodule Guilda.Servers do
  @moduledoc """
  The Servers context.

  Handles server CRUD, membership, roles, invites, and ownership.
  """

  import Ecto.Query, warn: false
  import Bitwise

  alias Guilda.Repo
  alias Guilda.Accounts.User
  alias Guilda.Servers.{Server, Role, ServerMember, Invite, Permissions}

  # ---------------------------------------------------------------------------
  # Servers — queries
  # ---------------------------------------------------------------------------

  @doc "Returns all servers the given user is a member of, ordered by name."
  def list_for_user(%User{id: user_id}) do
    Repo.all(
      from s in Server,
        join: sm in ServerMember,
        on: sm.server_id == s.id and sm.user_id == ^user_id,
        order_by: s.name,
        preload: [:owner]
    )
  end

  @doc "Gets a server by id. Returns nil if not found."
  def get_server(id), do: Repo.get(Server, id)

  @doc """
  Gets a server by id, preloading roles, categories, channels and member count.
  Returns nil if not found.
  """
  def get_server_detail(id) do
    Repo.one(
      from s in Server,
        where: s.id == ^id,
        preload: [
          :owner,
          roles: ^from(r in Role, order_by: r.position),
          channel_categories: ^from(c in Guilda.Channels.Category, order_by: c.position),
          channels: ^from(ch in Guilda.Channels.Channel, order_by: ch.position)
        ]
    )
  end

  @doc "Returns true if the given user is a member of the given server."
  def member?(%Server{id: server_id}, %User{id: user_id}) do
    Repo.exists?(
      from sm in ServerMember,
        where: sm.server_id == ^server_id and sm.user_id == ^user_id
    )
  end

  @doc "Gets the server membership for a user. Returns nil if not a member."
  def get_membership(%Server{id: server_id}, %User{id: user_id}) do
    Repo.one(
      from sm in ServerMember,
        where: sm.server_id == ^server_id and sm.user_id == ^user_id,
        preload: [:role]
    )
  end

  @doc "Lists all members of a server with their roles."
  def list_members(%Server{id: server_id}) do
    Repo.all(
      from sm in ServerMember,
        where: sm.server_id == ^server_id,
        preload: [:user, :role],
        order_by: sm.joined_at
    )
  end

  # ---------------------------------------------------------------------------
  # Servers — mutations
  # ---------------------------------------------------------------------------

  @doc """
  Creates a new server owned by `owner`.

  Also seeds default roles and adds the owner as a member with the Owner role.
  """
  def create_server(%User{} = owner, attrs) do
    Repo.transaction(fn ->
      server =
        %Server{}
        |> Server.changeset(Map.put(attrs, :owner_id, owner.id))
        |> Repo.insert!()

      {owner_role, _default_role} = seed_default_roles(server)

      now = DateTime.utc_now() |> DateTime.truncate(:second)

      %ServerMember{}
      |> ServerMember.changeset(%{
        server_id: server.id,
        user_id: owner.id,
        role_id: owner_role.id,
        joined_at: now
      })
      |> Repo.insert!()

      # Automatically seed default category and channel
      {:ok, category} =
        Guilda.Channels.create_category(server, %{name: "General", position: 0})

      {:ok, _channel} =
        Guilda.Channels.create_channel(server, %{
          name: "general",
          type: "text",
          category_id: category.id,
          position: 0
        })

      server
    end)
  end

  @doc "Updates a server's name, description, or icon_url. Requires owner or manage_server permission."
  def update_server(%Server{} = server, attrs) do
    server
    |> Server.changeset(attrs)
    |> Repo.update()
  end

  @doc "Deletes a server and all associated data (cascades via FK)."
  def delete_server(%Server{} = server) do
    Repo.delete(server)
  end

  @doc "Transfers ownership to another member."
  def transfer_ownership(%Server{} = server, %User{id: new_owner_id}) do
    server
    |> Server.changeset(%{owner_id: new_owner_id})
    |> Repo.update()
  end

  # ---------------------------------------------------------------------------
  # Membership
  # ---------------------------------------------------------------------------

  @doc """
  Adds a user to a server with the default member role.
  Returns `{:ok, member}` or `{:error, reason}`.
  """
  def add_member(%Server{id: server_id} = server, %User{id: user_id}) do
    default_role = get_default_role(server)
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    %ServerMember{}
    |> ServerMember.changeset(%{
      server_id: server_id,
      user_id: user_id,
      role_id: default_role && default_role.id,
      joined_at: now
    })
    |> Repo.insert()
  end

  @doc "Removes a user from a server."
  def remove_member(%Server{id: server_id}, %User{id: user_id}) do
    case Repo.get_by(ServerMember, server_id: server_id, user_id: user_id) do
      nil -> {:error, :not_member}
      member -> Repo.delete(member)
    end
  end

  @doc "Assigns a role to a member."
  def assign_role(%ServerMember{} = member, %Role{} = role) do
    member
    |> ServerMember.changeset(%{role_id: role.id})
    |> Repo.update()
  end

  # ---------------------------------------------------------------------------
  # Roles
  # ---------------------------------------------------------------------------

  @doc "Lists all roles for a server, ordered by position."
  def list_roles(%Server{id: server_id}) do
    Repo.all(from r in Role, where: r.server_id == ^server_id, order_by: r.position)
  end

  @doc "Gets a role by id."
  def get_role(id), do: Repo.get(Role, id)

  @doc "Gets the default role (is_default: true) for a server."
  def get_default_role(%Server{id: server_id}) do
    Repo.get_by(Role, server_id: server_id, is_default: true)
  end

  @doc "Creates a custom role."
  def create_role(%Server{} = server, attrs) do
    %Role{}
    |> Role.changeset(Map.put(attrs, :server_id, server.id))
    |> Repo.insert()
  end

  @doc "Updates a role's name or permissions."
  def update_role(%Role{} = role, attrs) do
    role
    |> Role.changeset(attrs)
    |> Repo.update()
  end

  @doc "Deletes a role (cannot delete default or owner role)."
  def delete_role(%Role{is_default: true}), do: {:error, :cannot_delete_default}
  def delete_role(%Role{} = role), do: Repo.delete(role)

  @doc "Checks if a member has the given permission bit."
  def has_permission?(%ServerMember{role: %Role{permissions: perms}}, permission) do
    Permissions.has_permission?(perms, permission)
  end

  def has_permission?(%ServerMember{role: nil}, _permission), do: false

  # ---------------------------------------------------------------------------
  # Invites
  # ---------------------------------------------------------------------------

  @doc "Creates a new invite for a server."
  def create_invite(%Server{} = server, %User{} = creator, opts \\ []) do
    code = generate_invite_code()
    max_uses = Keyword.get(opts, :max_uses)

    expires_at =
      case Keyword.get(opts, :expires_in_hours) do
        nil -> nil
        hours -> DateTime.utc_now() |> DateTime.add(hours * 3600, :second) |> DateTime.truncate(:second)
      end

    %Invite{}
    |> Invite.changeset(%{
      server_id: server.id,
      created_by: creator.id,
      code: code,
      max_uses: max_uses,
      expires_at: expires_at
    })
    |> Repo.insert()
  end

  @doc "Gets an invite by code."
  def get_invite_by_code(code) when is_binary(code) do
    Repo.get_by(Invite, code: code)
  end

  @doc "Consumes an invite — validates, increments uses, adds user to server."
  def consume_invite(code, %User{} = user) when is_binary(code) do
    Repo.transaction(fn ->
      invite = Repo.get_by(Invite, code: code)

      cond do
        is_nil(invite) ->
          Repo.rollback(:not_found)

        not Invite.valid?(invite) ->
          Repo.rollback(:expired)

        true ->
          server = Repo.get!(Server, invite.server_id)

          if member?(server, user) do
            Repo.rollback(:already_member)
          else
            Repo.update_all(
              from(i in Invite, where: i.id == ^invite.id),
              inc: [uses: 1]
            )

            case add_member(server, user) do
              {:ok, member} -> {server, member}
              {:error, reason} -> Repo.rollback(reason)
            end
          end
      end
    end)
  end

  @doc "Lists all invites for a server."
  def list_invites(%Server{id: server_id}) do
    Repo.all(
      from i in Invite,
        where: i.server_id == ^server_id,
        preload: [:creator],
        order_by: [desc: i.inserted_at]
    )
  end

  @doc "Revokes (deletes) an invite."
  def revoke_invite(%Invite{} = invite), do: Repo.delete(invite)

  # ---------------------------------------------------------------------------
  # Private helpers
  # ---------------------------------------------------------------------------

  defp seed_default_roles(%Server{id: server_id}) do
    owner_role =
      %Role{}
      |> Role.changeset(%{
        server_id: server_id,
        name: "Owner",
        permissions: Permissions.all_permissions(),
        position: 0,
        is_default: false
      })
      |> Repo.insert!()

    _admin_role =
      %Role{}
      |> Role.changeset(%{
        server_id: server_id,
        name: "Admin",
        permissions: Permissions.all_permissions() - Permissions.manage_server(),
        position: 1,
        is_default: false
      })
      |> Repo.insert!()

    _mod_role =
      %Role{}
      |> Role.changeset(%{
        server_id: server_id,
        name: "Moderator",
        permissions: Permissions.delete_messages() ||| Permissions.manage_invites() |||
                     Permissions.send_messages() ||| Permissions.attach_files() |||
                     Permissions.connect_voice() ||| Permissions.speak_voice(),
        position: 2,
        is_default: false
      })
      |> Repo.insert!()

    default_role =
      %Role{}
      |> Role.changeset(%{
        server_id: server_id,
        name: "Member",
        permissions: Permissions.default_permissions(),
        position: 3,
        is_default: true
      })
      |> Repo.insert!()

    {owner_role, default_role}
  end

  defp generate_invite_code do
    :crypto.strong_rand_bytes(6) |> Base.url_encode64(padding: false)
  end
end
