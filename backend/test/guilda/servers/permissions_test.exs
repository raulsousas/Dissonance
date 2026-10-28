defmodule Guilda.Servers.PermissionsTest do
  use ExUnit.Case, async: true

  alias Guilda.Servers.Permissions

  describe "has_permission?/2" do
    test "returns true when permission bit is set" do
      assert Permissions.has_permission?(Permissions.send_messages(), Permissions.send_messages())
    end

    test "returns false when permission bit is not set" do
      refute Permissions.has_permission?(Permissions.send_messages(), Permissions.manage_server())
    end

    test "owner with all permissions passes any check" do
      all = Permissions.all_permissions()
      assert Permissions.has_permission?(all, Permissions.manage_server())
      assert Permissions.has_permission?(all, Permissions.video())
      assert Permissions.has_permission?(all, Permissions.send_messages())
    end

    test "default permissions include send_messages and attach_files" do
      defaults = Permissions.default_permissions()
      assert Permissions.has_permission?(defaults, Permissions.send_messages())
      assert Permissions.has_permission?(defaults, Permissions.attach_files())
      assert Permissions.has_permission?(defaults, Permissions.connect_voice())
    end

    test "default permissions do not include manage_server" do
      defaults = Permissions.default_permissions()
      refute Permissions.has_permission?(defaults, Permissions.manage_server())
    end
  end
end
