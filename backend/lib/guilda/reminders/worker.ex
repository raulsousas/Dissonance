defmodule Guilda.Reminders.Worker do
  @moduledoc """
  Periodically fires due message reminders.

  Runs a cheap indexed query every `@interval_ms`. State lives in Postgres, so
  a restart never loses a reminder — anything overdue is picked up on the next
  tick.
  """

  use GenServer

  require Logger

  alias Guilda.Reminders

  @interval_ms 15_000

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: Keyword.get(opts, :name, __MODULE__))
  end

  @impl true
  def init(opts) do
    config = Application.get_env(:guilda, __MODULE__, [])
    interval = Keyword.get(opts, :interval_ms) || Keyword.get(config, :interval_ms, @interval_ms)
    # `:manual` (used in tests) never schedules ticks.
    if interval != :manual, do: schedule(interval)
    {:ok, %{interval: interval}}
  end

  @impl true
  def handle_info(:tick, %{interval: interval} = state) do
    run()
    schedule(interval)
    {:noreply, state}
  end

  defp schedule(interval), do: Process.send_after(self(), :tick, interval)

  defp run do
    reminders = Reminders.claim_due()
    Enum.each(reminders, &Reminders.notify/1)
    length(reminders)
  rescue
    error ->
      # DB may be unavailable (e.g. during boot); try again on the next tick.
      Logger.warning("reminder worker tick failed", error: Exception.message(error))
      0
  end
end
