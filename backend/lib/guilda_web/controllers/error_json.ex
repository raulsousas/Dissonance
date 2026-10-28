defmodule GuildaWeb.ErrorJSON do
  @moduledoc """
  Renders JSON error responses.
  """

  # 404
  def render("404.json", _assigns) do
    %{errors: %{detail: "Not Found"}}
  end

  # 500
  def render("500.json", _assigns) do
    %{errors: %{detail: "Internal Server Error"}}
  end

  # Catch-all
  def render(template, _assigns) do
    %{errors: %{detail: Phoenix.Controller.status_message_from_template(template)}}
  end
end
