"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api } from "@/lib/api";

// Live updates. The socket is a shortcut, never a requirement: while it is down every page
// falls back to the polling it always had, and a reconnect re-syncs whatever was missed.
export const RealtimeContext = createContext({ socket: null, connected: false });
export const useRealtime = () => useContext(RealtimeContext);

/** Opens one socket for the whole workspace. Used once, by the shell. */
export function useRealtimeConnection() {
  const [state, setState] = useState({ socket: null, connected: false });

  useEffect(() => {
    let cancelled = false;
    let socket = null;
    let retry = null;

    async function start() {
      let url;
      try {
        const response = await fetch("/api/auth/realtime", { cache: "no-store" });
        url = (await response.json()).url;
      } catch {
        return;
      }
      if (cancelled || !url) return;
      socket = io(url, {
        transports: ["websocket"],
        reconnectionDelayMax: 15000,
        // A fresh one-minute ticket for every (re)connection; the access token never leaves its cookie.
        auth: (done) => {
          api("frontend/realtime/ticket", { method: "POST" })
            .then((result) => done({ ticket: result.ticket }))
            .catch(() => done({ ticket: "" }));
        },
      });
      socket.on("connect", () => setState({ socket, connected: true }));
      socket.on("disconnect", () => setState({ socket, connected: false }));
      // A refused connection is not retried by socket.io itself, so try again later.
      socket.on("connect_error", () => {
        setState({ socket, connected: false });
        if (!socket.active) {
          clearTimeout(retry);
          retry = setTimeout(() => !cancelled && socket.connect(), 8000);
        }
      });
      setState({ socket, connected: socket.connected });
    }
    start();

    return () => {
      cancelled = true;
      clearTimeout(retry);
      socket?.disconnect();
    };
  }, []);

  return state;
}

/** Runs `handler` for every `event` on the shared socket. The latest handler is always used. */
export function useSocketEvent(event, handler) {
  const { socket } = useRealtime();
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!socket) return;
    const listener = (...args) => latest.current?.(...args);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [socket, event]);
}

/** Calls `handler` now and every time the socket reconnects, to catch up on what was missed. */
export function useOnConnect(handler) {
  const { connected } = useRealtime();
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (connected) latest.current?.();
  }, [connected]);
}
