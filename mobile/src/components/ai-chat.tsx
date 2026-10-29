import { useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { colors, gradients, radius } from "@/lib/config";
import { Text, TextInput } from "./ui";

type Message = { role: "user" | "assistant"; content: string };

/** Strips the simple markdown the assistant writes (bold, headings, bullets) so it reads cleanly as plain text. */
const plain = (text: string) =>
  text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\s)\*(\S.*?)\*(?=\s|$)/g, "$1$2")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/`([^`]+)`/g, "$1");

/** A chat with the platform's AI assistant. `endpoint` is the API path: the general assistant or the interest guide. */
export function AiChat({ endpoint = "frontend/ai/chat", starters, intro }: { endpoint?: string; starters: string[]; intro: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const list = useRef<FlatList<Message>>(null);
  const bottom = 8;

  async function send(content = text) {
    const value = content.trim();
    if (!value || pending) return;
    const history: Message[] = [...messages, { role: "user", content: value }];
    setMessages(history);
    setText("");
    setPending(true);
    setError("");
    try {
      const answer = await api<{ reply: string }>(endpoint, { method: "POST", body: { messages: history.slice(-24) } });
      setMessages([...history, { role: "assistant", content: answer.reply }]);
    } catch (problem: any) {
      setError(problem.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={90}>
      <FlatList
        ref={list}
        data={messages}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={{ padding: 14, gap: 10, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.empty}>
            <LinearGradient colors={gradients.ai} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logo}>
              <Ionicons name="sparkles" size={28} color="#fff" />
            </LinearGradient>
            <Text style={styles.intro}>{intro}</Text>
            <View style={{ gap: 8, alignSelf: "stretch" }}>
              {starters.map((starter) => (
                <Pressable key={starter} onPress={() => send(starter)} style={styles.starter}>
                  <Text style={{ color: colors.green, fontWeight: "700" }}>{starter}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) =>
          item.role === "user" ? (
            <LinearGradient colors={["#1f8c62", "#17684a"]} style={[styles.bubble, styles.mine]}>
              <Text style={{ color: "#fff", lineHeight: 21 }}>{item.content}</Text>
            </LinearGradient>
          ) : (
            <View style={[styles.bubble, styles.theirs]}>
              <Text style={{ color: colors.text, lineHeight: 22 }} selectable>
                {plain(item.content)}
              </Text>
            </View>
          )
        }
        ListFooterComponent={
          <>
            {pending ? (
              <View style={[styles.bubble, styles.theirs]}>
                <Text style={{ color: colors.muted }}>Thinking…</Text>
              </View>
            ) : null}
            {error ? <Text style={{ color: colors.red, marginTop: 6 }}>{error}</Text> : null}
          </>
        }
      />
      <View style={[styles.composer, { paddingBottom: bottom }]}>
        <TextInput value={text} onChangeText={setText} placeholder="Ask anything…" placeholderTextColor="#9aa7a0" multiline style={styles.input} />
        <Pressable onPress={() => send()} disabled={!text.trim() || pending} accessibilityLabel="Send" style={{ opacity: !text.trim() || pending ? 0.5 : 1 }}>
          <LinearGradient colors={gradients.ai} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
            <Ionicons name="send" size={18} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 10 },
  logo: { width: 64, height: 64, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  intro: { textAlign: "center", color: colors.muted, fontSize: 15, lineHeight: 22 },
  starter: { padding: 13, borderRadius: radius.md, backgroundColor: colors.greenSoft },
  bubble: { maxWidth: "88%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  mine: { alignSelf: "flex-end", borderBottomRightRadius: 5 },
  theirs: { alignSelf: "flex-start", backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 5 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, maxHeight: 120, minHeight: 44, borderRadius: 22, backgroundColor: colors.surfaceMuted, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: colors.text },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
