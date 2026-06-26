/* ════════════════════════════════════════════════════════════════════
   NetClient — thin WebSocket wrapper for VOID RAIDER co-op.
   Connects, joins a room, streams local input up, hands snapshots to the
   engine. Auto-reconnect with backoff. In dev it talks to the local
   server on :8787; in prod it uses the same origin (wss).
═══════════════════════════════════════════════════════════════════════ */

// Default cloud co-op server (used by the desktop app for internet play).
const CLOUD_SERVER = "wss://void-raider.onrender.com";

export function serverUrl() {
  // 1. manual runtime override — point anywhere, e.g. a local server:
  //    localStorage.setItem("voidraider_server", "ws://localhost:8787")
  try {
    const saved = localStorage.getItem("voidraider_server");
    if (saved) return saved.trim().replace(/^http/, "ws");
  } catch {
    /* ignore */
  }
  // 2. build-time override (e.g. VITE_SERVER_URL=wss://my-app.onrender.com)
  const override = import.meta.env.VITE_SERVER_URL;
  if (override) return override.replace(/^http/, "ws");
  // 3. dev → local server for testing
  if (import.meta.env.DEV) return "ws://localhost:8787";
  // 4. production:
  //    - desktop app is served by its embedded server on localhost, so it
  //      can't host remote friends → use the shared cloud server for co-op
  //    - web build on its own domain → connect same-origin (its own server)
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return CLOUD_SERVER;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}`;
}

export class NetClient {
  constructor({ onWelcome, onSnap, onStatus } = {}) {
    this.onWelcome = onWelcome || (() => {});
    this.onSnap = onSnap || (() => {});
    this.onStatus = onStatus || (() => {});
    this.ws = null;
    this.id = null;
    this.room = null;
    this.joinInfo = null;
    this.closedByUser = false;
    this.retry = 0;
  }

  connect(joinInfo) {
    this.joinInfo = joinInfo; // { name, country, room }
    this.closedByUser = false;
    this._open();
  }

  _open() {
    this.onStatus("connecting");
    let ws;
    try {
      ws = new WebSocket(serverUrl());
    } catch {
      this._scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.retry = 0;
      this.onStatus("connected");
      ws.send(JSON.stringify({ t: "join", ...this.joinInfo }));
    };

    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.t === "welcome") {
        this.id = msg.id;
        this.room = msg.room;
        this.onWelcome(msg);
      } else if (msg.t === "snap") {
        this.onSnap(msg);
      } else if (msg.t === "denied") {
        // server rejected the join (room full / at capacity) — don't retry
        this.closedByUser = true;
        this.onStatus("denied", msg.reason || "Unable to join.");
        try {
          this.ws.close();
        } catch {
          /* ignore */
        }
      }
    };

    ws.onclose = () => {
      if (this.closedByUser) return;
      this.onStatus("reconnecting");
      this._scheduleReconnect();
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  _scheduleReconnect() {
    this.retry = Math.min(this.retry + 1, 6);
    const delay = Math.min(500 * 2 ** this.retry, 8000);
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      if (!this.closedByUser) this._open();
    }, delay);
  }

  sendInput(x, y, firing) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ t: "input", x, y, firing }));
    }
  }

  setReady(ready) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ t: "ready", ready: !!ready }));
    }
  }

  startGame() {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ t: "start" }));
    }
  }

  restart() {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify({ t: "restart" }));
    }
  }

  close() {
    this.closedByUser = true;
    clearTimeout(this._timer);
    if (this.ws) this.ws.close();
  }
}
