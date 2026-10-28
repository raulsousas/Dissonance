defmodule GuildaWeb do
  @moduledoc """
  The entrypoint for defining your web interface, such as controllers,
  views, channels, and so on.

  This can be used in your application as:

      use GuildaWeb, :controller
      use GuildaWeb, :channel

  See the documentation for `Phoenix.Controller` for more information.
  """

  def static_paths, do: ~w(assets fonts images favicon.ico robots.txt)

  def router do
    quote do
      use Phoenix.Router, helpers: false
      import Plug.Conn
      import Phoenix.Controller
    end
  end

  def channel do
    quote do
      use Phoenix.Channel
    end
  end

  def controller do
    quote do
      use Phoenix.Controller,
        formats: [:json],
        layouts: []

      import Plug.Conn
      alias GuildaWeb.Router.Helpers, as: Routes

      unquote(verified_routes())
    end
  end

  def verified_routes do
    quote do
      use Phoenix.VerifiedRoutes,
        endpoint: GuildaWeb.Endpoint,
        router: GuildaWeb.Router,
        statics: GuildaWeb.static_paths()
    end
  end

  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
