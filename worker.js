// Durable Object（←これを必ず export！）
export class ChatRoom {
  constructor(state, env) {
    this.clients = [];
  }

  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("WebSocket only", { status: 400 });
    }

    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    this.handle(server);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  handle(ws) {
    ws.accept();

    // 接続追加
    this.clients.push(ws);

    // 人数送信
    this.broadcast({
      type: "count",
      count: this.clients.length
    });

    // メッセージ受信
    ws.addEventListener("message", (e) => {
      let data;

      try {
        data = JSON.parse(e.data);
      } catch {
        return;
      }

      // 簡易制限
      if (!data.text || data.text.length > 200) return;

      if (data.type === "msg") {
        this.broadcast(data);
      }
    });

    // 切断処理
    ws.addEventListener("close", () => {
      this.clients = this.clients.filter(c => c !== ws);

      this.broadcast({
        type: "count",
        count: this.clients.length
      });
    });
  }

  broadcast(data) {
    const msg = JSON.stringify(data);

    for (const client of this.clients) {
      try {
        client.send(msg);
      } catch {}
    }
  }
}

// Worker本体
export default {
  async fetch(request, env) {

    // WebSocket処理
    if (request.headers.get("Upgrade") === "websocket") {
      const url = new URL(request.url);
      const room = url.searchParams.get("room") || "default";

      const id = env.CHAT.idFromName(room);
      const obj = env.CHAT.get(id);

      return obj.fetch(request);
    }

    return new Response("OK");
  }
};
