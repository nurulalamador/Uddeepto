import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/config";
import { timeOnly, dateOnly } from "@/lib/format";
import { useLive, useSocketEvent } from "@/lib/realtime";
import { Avatar, ErrorBox, Loading, Muted, Text, TextInput } from "./ui";

export type ChatMessage = { id: string; sender_id: string; content: string; at: string; sender_name?: string; sender_has_picture?: boolean };

/** Reads a message from either kind of chat (direct: sent_at, community: created_at) into one shape. */
const normalize = (row: any): ChatMessage => ({ id: row.id, sender_id: row.sender_id, content: row.content, at: row.sent_at || row.created_at, sender_name: row.sender_name, sender_has_picture: row.sender_has_picture });

/**
 * A conversation. `path` lists and posts messages. New ones arrive through the socket (`liveEvent`, `accept` picks the
 * ones that belong here) and, as a safety net, a refresh every few seconds.
 */
export function ChatView({ path, group, liveEvent, accept, conversationId }: { path: string; group: boolean; liveEvent: string; accept: (payload: any) => any; conversationId?: string }) {
  const { user } = useAuth();
  const { connected, markConversationSeen } = useLive();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState("");
  const alive = useRef(true);

  const merge = useCallback((incoming: ChatMessage[]) => {
    setMessages((current) => {
      const known = new Map(current.map((message) => [message.id, message]));
      for (const message of incoming) known.set(message.id, message);
      return [...known.values()].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    });
  }, []);

  const load = useCallback(
    async (quiet: boolean) => {
      try {
        const rows = await api<any[]>(path);
        if (!alive.current) return;
        merge(rows.map(normalize));
        setError("");
      } catch (failure: any) {
        if (alive.current && !quiet) setError(failure.message);
      } finally {
        if (alive.current) setLoading(false);
      }
    },
    [path, merge],
  );

  useEffect(() => {
    alive.current = true;
    load(false);
    const timer = setInterval(() => load(true), connected ? 25000 : 5000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [load, connected]);

  useEffect(() => {
    if (conversationId) markConversationSeen(conversationId);
  }, [conversationId, messages.length, markConversationSeen]);

  useSocketEvent(liveEvent, (payload) => {
    const message = accept(payload);
    if (message) merge([normalize(message)]);
  });

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setProblem("");
    try {
      const sent = await api<any>(path, { method: "POST", body: { content } });
      setText("");
      merge([normalize({ ...sent, sender_name: user?.name })]);
    } catch (failure: any) {
      setProblem(failure.message);
    } finally {
      setSending(false);
    }
  }

  if (loading) return <Loading />;
  if (error && !messages.length) return <ErrorBox message={error} onRetry={() => load(false)} />;

  const rows = [...messages].reverse(); // the list is upside down so it starts at the newest message

  return (
    <KeyboardAvoidingView testID={connected ? "chat-connected" : "chat-disconnected"} style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={90}>
      <FlatList
        inverted
        data={rows}
        keyExtractor={(message) => message.id}
        contentContainerStyle={{ padding: 12, gap: 6 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Muted style={{ textAlign: "center", padding: 24 }}>No messages yet. Say hello!</Muted>}
        renderItem={({ item, index }) => {
          const mine = item.sender_id === user?.id;
          const older = rows[index + 1];
          const newDay = !older || dateOnly(older.at) !== dateOnly(item.at);
          const showName = group && !mine && (!older || older.sender_id !== item.sender_id || newDay);
          return (
            <View>
              {newDay ? <Text style={styles.day}>{dateOnly(item.at)}</Text> : null}
              <View style={[styles.line, mine && { justifyContent: "flex-end" }]}>
                {group && !mine ? <Avatar id={item.sender_id} name={item.sender_name} hasPicture={item.sender_has_picture} size={28} /> : null}
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  {showName ? <Text style={styles.sender}>{item.sender_name}</Text> : null}
                  <Text style={[styles.text, mine && { color: "#fff" }]}>{item.content}</Text>
                  <Text style={[styles.time, mine && { color: "#cfe9dc" }]}>{timeOnly(item.at)}</Text>
                </View>
              </View>
            </View>
          );
        }}
      />
      {problem ? <Text style={styles.problem}>{problem}</Text> : null}
      <View style={styles.composer}>
        <TextInput testID="chat-input" value={text} onChangeText={setText} placeholder="Write a message…" placeholderTextColor="#9aa7a0" style={styles.input} multiline maxLength={4000} />
        <Pressable testID="chat-send" onPress={send} disabled={!text.trim() || sending} accessibilityState={{ disabled: !text.trim() || sending }} style={[styles.send, (!text.trim() || sending) && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Send message">
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  day: { alignSelf: "center", color: colors.muted, fontSize: 12, fontWeight: "700", marginVertical: 10 },
  line: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  bubble: { maxWidth: "80%", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  mine: { backgroundColor: colors.green, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  sender: { color: colors.orange, fontWeight: "800", fontSize: 12 },
  text: { color: colors.text, fontSize: 15, lineHeight: 21 },
  time: { color: colors.muted, fontSize: 10, alignSelf: "flex-end" },
  composer: { flexDirection: "row", gap: 8, alignItems: "flex-end", padding: 10, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, maxHeight: 120, minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 21, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: colors.text },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  problem: { color: colors.red, paddingHorizontal: 14, paddingBottom: 4 },
});
