import { useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { colors } from "@/lib/config";
import { useApi } from "@/lib/hooks";
import { count } from "@/lib/format";
import { Avatar, ErrorBox, Loading, Muted, Text, TextInput } from "@/components/ui";
import { PostCard, type Post } from "@/components/post-card";

type Comment = { id: string; commenter_id: string; content: string; name: string; commenter_has_picture: boolean; reactions: string | number; my_reaction: boolean };

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const post = useApi<Post>(`frontend/showcase/${id}`);
  const comments = useApi<Comment[]>(`frontend/showcase/${id}/comments`);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    const content = text.trim();
    if (!content || busy) return;
    setBusy(true);
    setError("");
    try {
      await api(`frontend/showcase/${id}/comments`, { method: "POST", body: { content } });
      setText("");
      await comments.reload();
    } catch (problem: any) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  async function like(comment: Comment) {
    const next = !comment.my_reaction;
    comments.setData((rows) => (rows || []).map((row) => (row.id === comment.id ? { ...row, my_reaction: next, reactions: count(row.reactions) + (next ? 1 : -1) } : row)));
    try {
      await api(`frontend/comments/${comment.id}/reaction`, { method: "PUT" });
    } catch {
      comments.reload();
    }
  }

  if (post.loading) return <Loading />;
  if (!post.data) return <ErrorBox message={post.error || "This post is no longer available."} onRetry={post.reload} />;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={90}>
      <FlatList
        data={comments.data || []}
        keyExtractor={(comment) => comment.id}
        contentContainerStyle={{ padding: 14, gap: 10 }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <PostCard post={post.data} detail onDeleted={() => router.back()} />
            <Text style={styles.heading}>Comments</Text>
          </View>
        }
        ListEmptyComponent={comments.loading ? <Loading /> : <Muted style={{ textAlign: "center", padding: 16 }}>No comments yet. Say something kind.</Muted>}
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <Pressable onPress={() => router.push(`/user/${item.commenter_id}`)}>
              <Avatar id={item.commenter_id} name={item.name} hasPicture={item.commenter_has_picture} size={34} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <View style={styles.bubble}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.text}>{item.content}</Text>
              </View>
              <Pressable testID={`comment-like-${item.id}`} accessibilityRole="button" accessibilityLabel={item.my_reaction ? "Remove comment appreciation" : "Appreciate comment"} onPress={() => like(item)} style={styles.like} hitSlop={6}>
                <Ionicons name={item.my_reaction ? "heart" : "heart-outline"} size={15} color={item.my_reaction ? colors.red : colors.muted} />
                <Text style={styles.likeText}>{count(item.reactions)}</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.composer}>
        <TextInput testID="comment-input" value={text} onChangeText={setText} placeholder="Write a comment…" placeholderTextColor="#9aa7a0" style={styles.input} multiline maxLength={2000} />
        <Pressable testID="comment-send" onPress={send} disabled={!text.trim() || busy} accessibilityState={{ disabled: !text.trim() || busy }} style={[styles.send, (!text.trim() || busy) && { opacity: 0.5 }]} accessibilityLabel="Send comment" accessibilityRole="button">
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 4 },
  comment: { flexDirection: "row", gap: 8 },
  bubble: { backgroundColor: colors.card, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: colors.border },
  name: { fontWeight: "800", fontSize: 13, color: colors.text },
  text: { color: colors.text, fontSize: 14, lineHeight: 20, marginTop: 2 },
  like: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, marginLeft: 8 },
  likeText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  composer: { flexDirection: "row", gap: 8, alignItems: "flex-end", padding: 10, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border },
  input: { flex: 1, maxHeight: 110, minHeight: 42, borderWidth: 1, borderColor: colors.border, borderRadius: 21, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: colors.text },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  error: { color: colors.red, paddingHorizontal: 14, paddingBottom: 4 },
});
