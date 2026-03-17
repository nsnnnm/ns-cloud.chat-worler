export default {
  async fetch(req, env) {
    // WebSocket接続判定
    if (req.headers.get("Upgrade") === "websocket") {
      const url = new URL(req.url);
      const room = url.searchParams.get("room") || "main";

      // ルームごとにDurable Object
      const id = env.CHAT.idFromName(room);
      const obj = env.CHAT.get(id);

      return obj.fetch(req);
    }

    return new Response("Chat Worker is running");
  }
};

export class ChatRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;

    this.clients = [];
    this.lastRead = {}; // {username: timestamp}
  }

  async fetch(req) {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];

    server.accept();

    // 接続追加
    this.clients.push(server);

    // 接続人数送信
    this.broadcast({
      type: "count",
      count: this.clients.length
    });

    // メッセージ受信
    server.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // ===== メッセージ =====
        if (data.type === "msg") {
          const msg = {
            type: "msg",
            name: data.name || "名無し",
            text: data.text || "",
            time: Date.now()
          };
          this.broadcast(msg);
        }

        // ===== 画像 =====
        if (data.type === "img") {
          const msg = {
            type: "img",
            name: data.name || "名無し",
            img: data.img, // base64
            time: Date.now()
          };
          this.broadcast(msg);
        }

        // ===== 既読 =====
        if (data.type === "read") {
          const username = data.name || "名無し";
          const now = Date.now();

          this.lastRead[username] = now;

          this.broadcast({
            type: "read",
            name: username,
            time: now
          });
        }

      } catch (err) {
        console.error("JSON parse error:", err);
      }
    };

    // 切断処理
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

  // ===== 全員に送信 =====
  broadcast(data) {
    const msg = JSON.stringify(data);

    this.clients.forEach(client => {
      try {
        client.send(msg);
      } catch (e) {
        // 壊れた接続を削除
        this.clients = this.clients.filter(c => c !== client);
      }
    });
  }
}
