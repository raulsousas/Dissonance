defmodule GuildaWeb.UploadController do
  use GuildaWeb, :controller
  require Logger

  alias Guilda.Storage

  def create(conn, %{"file" => %Plug.Upload{} = upload}) do
    user_id = conn.assigns[:current_user] && conn.assigns[:current_user].id
    Logger.info("[UploadController] Uploading file filename=#{inspect(upload.filename)} content_type=#{inspect(upload.content_type)} user_id=#{user_id}")

    case Storage.upload_file(upload) do
      {:ok, attachment} ->
        Logger.info("[UploadController] Upload success id=#{attachment.id} url=#{attachment.url} size=#{attachment.size}")
        json(conn, %{
          attachment: %{
            id: attachment.id,
            url: attachment.url,
            filename: attachment.filename,
            size: attachment.size,
            contentType: attachment.content_type,
            width: attachment.width,
            height: attachment.height
          }
        })

      {:error, :file_too_large} ->
        Logger.warning("[UploadController] File too large filename=#{inspect(upload.filename)}")
        conn |> put_status(413) |> json(%{error: "File exceeds maximum upload size (25MB)"})

      {:error, :invalid_content_type} ->
        Logger.warning("[UploadController] Unsupported file type filename=#{inspect(upload.filename)} content_type=#{inspect(upload.content_type)}")
        conn |> put_status(422) |> json(%{error: "Unsupported file type"})

      {:error, reason} ->
        Logger.error("[UploadController] Upload failed reason=#{inspect(reason)}")
        conn |> put_status(500) |> json(%{error: "Failed to upload file"})
    end
  end

  def create(conn, _params) do
    Logger.warning("[UploadController] Missing file parameter in request")
    conn |> put_status(400) |> json(%{error: "Missing file parameter"})
  end
end
