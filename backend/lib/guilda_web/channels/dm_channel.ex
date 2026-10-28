defmodule GuildaWeb.DmChannel do
  @moduledoc "Phoenix Channel stub for direct messages (Phase 5)."
  use Phoenix.Channel

  @impl true
  def join("dm:" <> _conv_id, _payload, socket) do
    if is_nil(socket.assigns[:current_user]) do
      {:error, %{reason: "unauthenticated"}}
    else
      {:ok, socket}
    end
  end
end
