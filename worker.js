export default {
  async fetch(request, env) {

    // WebSocket判定
    if (request.headers.get("Upgrade") === "websocket") {
      const url = new URL(request.url);

      // 部屋名（ページごと）
      const room = url.searchParams.get("room") || "default";

      // Durable Object取得
      const id = env.CHAT.idFromName(room);
      const obj = env.CHAT.get(id);

      return obj.fetch(request);
    }

    return new Response("OK");
  }
};
