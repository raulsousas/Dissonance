defmodule Guilda.Storage do
  @moduledoc """
  Handles file uploads and storage (Local + S3/LocalStack).
  """

  alias Guilda.Messaging.Attachment

  @upload_dir Path.expand("priv/static/uploads")

  @doc """
  Uploads a `Plug.Upload` struct and returns metadata map on success.
  """
  def upload_file(%Plug.Upload{} = upload) do
    max_bytes = String.to_integer(System.get_env("MAX_UPLOAD_BYTES") || "26214400")

    case File.stat(upload.path) do
      {:ok, %{size: size}} when size > max_bytes ->
        {:error, :file_too_large}

      {:ok, %{size: size}} ->
        content_type = upload.content_type || MIME.from_path(upload.filename)

        if content_type in Attachment.allowed_content_types() do
          ext = Path.extname(upload.filename)
          unique_id = Ecto.UUID.generate()
          safe_name = "#{unique_id}#{ext}"

          # Ensure local static directory exists and copy file
          File.mkdir_p!(@upload_dir)
          dest_path = Path.join(@upload_dir, safe_name)
          File.cp!(upload.path, dest_path)

          # Attempt S3 upload if configured
          s3_bucket = System.get_env("S3_BUCKET", "guilda")

          try do
            upload.path
            |> File.read!()
            |> ExAws.S3.put_object(s3_bucket, "uploads/#{safe_name}", content_type: content_type)
            |> ExAws.request()
          rescue
            _ -> :ok
          end

          url = "/uploads/#{safe_name}"

          {:ok,
           %{
             id: unique_id,
             url: url,
             filename: upload.filename,
             size: size,
             content_type: content_type,
             width: nil,
             height: nil
           }}
        else
          {:error, :invalid_content_type}
        end

      _ ->
        {:error, :cannot_read_file}
    end
  end
end
