defmodule GuildaWeb.UserChannel do
  @moduledoc """
  Phoenix Channel for personal notifications for a single user (`user:<user_id>`).
  """

  use Phoenix.Channel

  @impl true
  def join("user:" <> user_id, _payload, socket) do
    user = socket.assigns[:current_user]

    cond do
      is_nil(user) ->
        {:error, %{reason: "unauthenticated"}}

      user.id != user_id ->
        {:error, %{reason: "forbidden"}}

      true ->
        {:ok, assign(socket, :user_id, user_id)}
    end
  end
end
