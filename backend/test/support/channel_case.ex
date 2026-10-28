defmodule GuildaWeb.ChannelCase do
  @moduledoc """
  Helper for Phoenix channel tests.
  Provides `connect_authenticated_socket/1` and fixtures.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      use GuildaWeb.ChannelCase
      import GuildaWeb.ChannelCase
      alias Guilda.Repo
    end
  end

  setup tags do
    pid = Ecto.Adapters.SQL.Sandbox.start_owner!(Guilda.Repo, shared: not tags[:async])
    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(pid) end)

    :ok
  end
end
