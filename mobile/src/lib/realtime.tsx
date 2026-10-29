import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io, type Socket } from "socket.io-client";
import { api } from "./api";
import { SOCKET_URL } from "./config";
import { useAuth } from "./auth";

type Conversation = { id: string; updated_at: string };
type Live = {
  socket: Socket | null;
  connected: boolean;
  notifications: number;
  messages: number;
  /** Ids of the conversations with something new in them. */
  unreadConversations: string[];
  refreshCounts: () => void;
  /** The person has opened or written in a conversation: it counts as read up to now. */
  markConversationSeen: (id: string) => void;
};

const LiveContext = createContext<Live>({ socket: null, connected: false, notifications: 0, messages: 0, unreadConversations: [], refreshCounts: () => {}, markConversationSeen: () => {} });
export const useLive = () => useContext(LiveContext);

const SEEN_KEY = "uddeepto.conversations.seen";

/**
 * The live part of the app: one socket (a shortcut, never a requirement - everything also refreshes on a timer and when
 * the app comes back to the front), the notification count, and the count of conversations with something new.
 * The server keeps no "unread" mark for messages, so the phone remembers when each conversation was last seen.
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState(0);
  const [unreadConversations, setUnreadConversations] = useState<string[]>([]);
  const seen = useRef<Record<string, string>>({});
  const unreadIds = useRef(new Set<string>());
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const countNotifications = useCallback(async () => {
    try {
      setNotifications((await api<{ count: number }>("frontend/notifications/unread-count")).count);
    } catch {
      /* the next refresh will try again */
    }
  }, []);

  const saveSeen = () => AsyncStorage.setItem(SEEN_KEY, JSON.stringify(seen.current)).catch(() => {});

  const countMessages = useCallback(async () => {
    try {
      if (!loaded.current) {
        seen.current = JSON.parse((await AsyncStorage.getItem(SEEN_KEY)) || "{}");
        loaded.current = true;
      }
      const list = await api<Conversation[]>("frontend/messages");
      let changed = false;
      unreadIds.current = new Set();
      for (const conversation of list) {
        // Conversations that were already there when the app was first used start as read.
        if (!seen.current[conversation.id]) {
          seen.current[conversation.id] = conversation.updated_at;
          changed = true;
        } else if (new Date(conversation.updated_at) > new Date(seen.current[conversation.id])) unreadIds.current.add(conversation.id);
      }
      if (changed) saveSeen();
      setUnreadConversations([...unreadIds.current]);
    } catch {
      /* the next refresh will try again */
    }
  }, []);

  const refreshCounts = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      countNotifications();
      countMessages();
    }, 250);
  }, [countMessages, countNotifications]);

  const markConversationSeen = useCallback((id: string) => {
    seen.current[id] = new Date(Date.now() + 1000).toISOString();
    unreadIds.current.delete(id);
    setUnreadConversations([...unreadIds.current]);
    saveSeen();
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications(0);
      setUnreadConversations([]);
      return;
    }
    refreshCounts();
    const interval = setInterval(refreshCounts, 45000);
    const subscription = AppState.addEventListener("change", (state) => state === "active" && refreshCounts());
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [user, refreshCounts]);

  useEffect(() => {
    if (!user) return;
    let stopped = false;
    const connection = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnectionDelayMax: 15000,
      // A fresh one-minute ticket for every (re)connection.
      auth: (done) => {
        api<{ ticket: string }>("frontend/realtime/ticket", { method: "POST" })
          .then((result) => done({ ticket: result.ticket }))
          .catch(() => done({ ticket: "" }));
      },
    });
    connection.on("connect", () => !stopped && (setConnected(true), refreshCounts()));
    connection.on("disconnect", () => !stopped && setConnected(false));
    connection.on("connect_error", () => {
      if (!stopped) setConnected(false);
    });
    connection.on("notification", () => setNotifications((value) => value + 1));
    for (const event of ["notification:removed", "notification:changed"]) connection.on(event, refreshCounts);
    connection.on("message:new", (payload: { conversation_id: string; message: { sender_id: string } }) => {
      if (payload.message?.sender_id !== user.id) {
        unreadIds.current.add(payload.conversation_id);
        setUnreadConversations([...unreadIds.current]);
      }
    });
    setSocket(connection);
    return () => {
      stopped = true;
      connection.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user, refreshCounts]);

  const messages = unreadConversations.length;
  const value = useMemo(() => ({ socket, connected, notifications, messages, unreadConversations, refreshCounts, markConversationSeen }), [socket, connected, notifications, messages, unreadConversations, refreshCounts, markConversationSeen]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

/** Runs `handler` for every `event` on the shared socket. The latest handler is always used. */
export function useSocketEvent(event: string, handler: (...args: any[]) => void) {
  const { socket } = useLive();
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    if (!socket) return;
    const listener = (...args: any[]) => latest.current(...args);
    socket.on(event, listener);
    return () => {
      socket.off(event, listener);
    };
  }, [socket, event]);
}
