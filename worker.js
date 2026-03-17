export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    // ===== WebSocket =====
    if (req.headers.get("Upgrade") === "websocket") {
      const room = url.searchParams.get("room") || "main";

      const id = env.CHAT.idFromName(room);
      const obj = env.CHAT.get(id);

      return obj.fetch(req);
    }

    return new Response("OK");
  }
};

export class ChatRoom {
  constructor(state) {
    this.state = state;
    this.clients = [];
  }

  async fetch(req) {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();

    // ===== 履歴送信（超重要） =====
    let history = await this.state.storage.get("history") || [];

    server.send(JSON.stringify({
      type: "history",
      messages: history
    }));

    this.clients.push(server);

    this.broadcast({
      type: "count",
      count: this.clients.length
    });

    // ===== 受信 =====
    server.onmessage = async (e) => {
      const data = JSON.parse(e.data);

      if (data.type === "msg" || data.type === "img") {
        data.time = Date.now();

        await this.save(data); // ←保存
        this.broadcast(data);
      }

      if (data.type === "read") {
        this.broadcast(data);
      }
    };

    // ===== 切断 =====
    server.onclose = () => {
      this.clients = this.clients.filter(c => c !== server);

      this.broadcast({
        type: "count",
        count: this.clients.length
      });
    };

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  // ===== 履歴保存 =====
  async save(msg) {
    let history = await this.state.storage.get("history") || [];

    history.push(msg);

    if (history.length > 100) {
      history.shift();
    }

    await this.state.storage.put("history", history);
  }

  // ===== 全送信 =====
  broadcast(data) {
    const msg = JSON.stringify(data);

    this.clients.forEach(c => {
      try { c.send(msg); } catch {}
    });
  }
}
