import { useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/config";
import { ago, count } from "@/lib/format";
import { Avatar, Button, Card, Chip, Dropdown, Input, Notice, RemoteImage, Sheet, Text } from "./ui";
import { MediaPlayer } from "./media";

export type Post = {
  id: string;
  creator_id: string;
  content: string;
  created_at: string;
  creator_name: string;
  creator_has_picture: boolean;
  creator_role?: string;
  category_name?: string;
  reactions: string | number;
  comments: string | number;
  my_reaction: boolean;
  media: { id: string; mime_type: string; file_name?: string }[];
};

const REASONS = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Harassment" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "other", label: "Something else" },
];

export function PostCard({ post, detail = false, onDeleted }: { post: Post; detail?: boolean; onDeleted?: () => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [width, setWidth] = useState(0);
  const mine = user?.id === post.creator_id;
  const canDelete = mine || user?.role === "admin";

  function confirmDelete() {
    setMenu(false);
    Alert.alert("Delete this post?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`frontend/showcase/${post.id}`, { method: "DELETE" });
            onDeleted?.();
          } catch (problem: any) {
            Alert.alert("Could not delete", problem.message);
          }
        },
      },
    ]);
  }

  async function sendReport() {
    if (!reason) return setReportMessage("Choose a reason.");
    setSending(true);
    setReportMessage("");
    try {
      await api(`showcase/${post.id}/report`, { method: "POST", body: { reason, details: details.trim() } });
      setReporting(false);
      setReason("");
      setDetails("");
      Alert.alert("Thank you", "Your report was sent to the moderators.");
    } catch (problem: any) {
      setReportMessage(problem.message);
    } finally {
      setSending(false);
    }
  }
  const [liked, setLiked] = useState(post.my_reaction);
  const [likes, setLikes] = useState(count(post.reactions));
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !liked;
    setLiked(next);
    setLikes((value) => value + (next ? 1 : -1));
    try {
      await api(`frontend/showcase/${post.id}/reaction`, { method: "PUT" });
    } catch {
      setLiked(!next);
      setLikes((value) => value + (next ? -1 : 1));
    } finally {
      setBusy(false);
    }
  }

  const open = () => !detail && router.push(`/post/${post.id}`);
  const pictures = post.media.filter((item) => item.mime_type.startsWith("image/"));
  const others = post.media.filter((item) => !item.mime_type.startsWith("image/"));

  return (
    <Card testID={`post-card-${post.id}`} onPress={detail ? undefined : open} style={{ gap: 10 }}>
      <Pressable style={styles.head} onPress={() => router.push(`/user/${post.creator_id}`)}>
        <Avatar id={post.creator_id} name={post.creator_name} hasPicture={post.creator_has_picture} size={42} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{post.creator_name}</Text>
            {post.creator_role === "hirer" ? (
              <View style={styles.role}>
                <Text style={styles.roleText}>Hirer</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.sub}>
            {ago(post.created_at)}
            {post.category_name ? ` · ${post.category_name}` : ""}
          </Text>
        </View>
        <Pressable testID={`post-menu-${post.id}`} onPress={() => setMenu(true)} hitSlop={10} accessibilityLabel="More options" style={styles.dots}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.muted} />
        </Pressable>
      </Pressable>

      <Sheet visible={menu} title="Post options" onClose={() => setMenu(false)}>
        {canDelete ? <Button label="Delete post" icon="trash-outline" kind="danger" onPress={confirmDelete} style={{ marginBottom: 8 }} /> : null}
        {!mine ? <Button label="Report post" icon="flag-outline" kind="secondary" onPress={() => { setMenu(false); setReporting(true); }} style={{ marginBottom: 8 }} /> : null}
      </Sheet>
      <Sheet visible={reporting} title="Report post" onClose={() => setReporting(false)}>
        <View style={{ gap: 12, paddingBottom: 8 }}>
          <Dropdown label="Reason" value={reason} placeholder="Choose a reason" options={REASONS} onChange={setReason} />
          <Input label="Details (optional)" value={details} onChangeText={setDetails} multiline maxLength={2000} />
          {reportMessage ? <Notice>{reportMessage}</Notice> : null}
          <Button label="Send report" icon="flag" onPress={sendReport} busy={sending} />
        </View>
      </Sheet>

      <Text style={styles.content}>{post.content}</Text>

      {pictures.length > 0 && (
        <View style={styles.pictures} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          {pictures.slice(0, 4).map((item) => (
            <RemoteImage
              key={item.id}
              testID={`post-image-${post.id}`}
              path={`frontend/showcase/${post.id}/media/${item.id}`}
              style={[styles.picture, pictures.length === 1 ? { width, height: width * 0.75 } : { width: (width - 6) / 2, height: (width - 6) / 2 }]}
            />
          ))}
        </View>
      )}
      {others.map((item) => (
        <MediaPlayer key={item.id} path={`frontend/showcase/${post.id}/media/${item.id}`} audio={item.mime_type.startsWith("audio/")} name={item.file_name} />
      ))}

      <View style={styles.actions}>
        <Pressable testID={`post-appreciate-${post.id}`} onPress={toggle} style={styles.action} hitSlop={8} accessibilityRole="button" accessibilityLabel={liked ? "Remove appreciation" : "Appreciate"}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={22} color={liked ? colors.red : colors.muted} />
          <Text style={[styles.actionText, liked && { color: colors.red }]}>{likes}</Text>
        </Pressable>
        <Pressable onPress={open} style={styles.action} hitSlop={8}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.muted} />
          <Text style={styles.actionText}>{count(post.comments)}</Text>
        </Pressable>
        {post.category_name ? (
          <View style={{ marginLeft: "auto" }}>
            <Chip label={post.category_name} />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  dots: { padding: 4 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { fontWeight: "800", color: colors.text, fontSize: 15, flexShrink: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  role: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999, backgroundColor: colors.greenSoft },
  roleText: { color: colors.green, fontWeight: "700", fontSize: 11 },
  sub: { color: colors.muted, fontSize: 12 },
  content: { color: colors.text, fontSize: 15, lineHeight: 22 },
  pictures: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  picture: { borderRadius: 12, backgroundColor: "#e9efeb" },
  actions: { flexDirection: "row", alignItems: "center", gap: 18, paddingTop: 4 },
  action: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionText: { color: colors.muted, fontWeight: "700" },
});
