defmodule Guilda.Servers.InviteTest do
  use ExUnit.Case, async: true

  alias Guilda.Servers.Invite

  describe "valid?/1" do
    test "invite with no expiry and no use limit is valid" do
      invite = %Invite{expires_at: nil, max_uses: nil, uses: 0}
      assert Invite.valid?(invite)
    end

    test "invite is invalid when expired" do
      past = DateTime.add(DateTime.utc_now(), -3600, :second)
      invite = %Invite{expires_at: past, max_uses: nil, uses: 0}
      refute Invite.valid?(invite)
    end

    test "invite is invalid when max uses reached" do
      invite = %Invite{expires_at: nil, max_uses: 5, uses: 5}
      refute Invite.valid?(invite)
    end

    test "invite is valid when uses are below max" do
      future = DateTime.add(DateTime.utc_now(), 3600, :second)
      invite = %Invite{expires_at: future, max_uses: 10, uses: 3}
      assert Invite.valid?(invite)
    end
  end
end
