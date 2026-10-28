defmodule Guilda.Messaging.Attachment do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  # MIME types allowed for upload
  @allowed_content_types ~w(
    image/jpeg image/png image/gif image/webp image/svg+xml
    video/mp4 video/webm
    audio/mpeg audio/ogg audio/wav
    application/pdf
    text/plain
    application/zip application/x-tar
    application/octet-stream
  )

  def allowed_content_types, do: @allowed_content_types

  schema "message_attachments" do
    field :url, :string
    field :filename, :string
    field :size, :integer
    field :content_type, :string
    field :width, :integer
    field :height, :integer

    belongs_to :message, Guilda.Messaging.Message

    timestamps(updated_at: false)
  end

  @required ~w(url filename size content_type message_id)a
  @optional ~w(width height)a

  def changeset(attachment, attrs) do
    max_bytes = String.to_integer(System.get_env("MAX_UPLOAD_BYTES") || "26214400")

    attachment
    |> cast(attrs, @required ++ @optional)
    |> validate_required(@required)
    |> validate_length(:filename, min: 1, max: 255)
    |> validate_number(:size, greater_than: 0, less_than_or_equal_to: max_bytes)
    |> validate_inclusion(:content_type, @allowed_content_types)
    |> assoc_constraint(:message)
  end
end
