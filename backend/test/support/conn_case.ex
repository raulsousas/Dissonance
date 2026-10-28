defmodule GuildaWeb.ConnCase do
  @moduledoc """
  This module defines the test case to be used by tests that require
  setting up a connection.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      # Import conveniences for testing with connections
      import Plug.Conn
      import Phoenix.ConnTest
      import GuildaWeb.ConnCase

      # Verified routes (sigil ~p)
      use GuildaWeb, :verified_routes

      alias Guilda.Repo

      # The default endpoint for testing
      @endpoint GuildaWeb.Endpoint
    end
  end

  setup tags do
    Guilda.DataCase.setup_sandbox(tags)
    {:ok, conn: Phoenix.ConnTest.build_conn()}
  end
end
