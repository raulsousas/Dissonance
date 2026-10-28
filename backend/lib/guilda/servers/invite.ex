defmodule Guilda.Servers.Invite do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  schema "invites" do
    field :code, :string
    field :max_uses, :integer
    field :uses, :integer, default: 0
    field :expires_at, :utc_datetime

    belongs_to :server, Guilda.Servers.Server
    belongs_to :creator, Guilda.Accounts.User, foreign_key: :created_by

    timestamps(updated_at: false)
  end

  @required ~w(server_id created_by code)a
  @optional ~w(max_uses expires_at)a

  def changeset(invite, attrs) do
    invite
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_length(:code, min: 6, max: 20)
    |> validate_number(:max_uses, greater_than: 0)
    |> assoc_constraint(:server)
    |> unique_constraint(:code)
  end

  @doc "Returns true if the invite has not expired and has remaining uses."
  def valid?(%__MODULE__{} = invite) do
    not expired?(invite) and not exhausted?(invite)
  end

  defp expired?(%{expires_at: nil}), do: false
  defp expired?(%{expires_at: expires_at}), do: DateTime.compare(expires_at, DateTime.utc_now()) == :lt

  defp exhausted?(%{max_uses: nil}), do: false
  defp exhausted?(%{max_uses: max, uses: uses}), do: uses >= max
end
