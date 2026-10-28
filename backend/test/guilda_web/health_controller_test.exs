defmodule GuildaWeb.HealthControllerTest do
  use GuildaWeb.ConnCase, async: true

  describe "GET /health" do
    test "returns 200 with status ok", %{conn: conn} do
      conn = get(conn, "/health")
      assert json_response(conn, 200) == %{"status" => "ok", "app" => "guilda"}
    end
  end
end
