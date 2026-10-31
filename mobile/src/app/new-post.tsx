import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { colors } from "@/lib/config";
import { useCategories } from "@/lib/hooks";
import { prepareImage } from "@/lib/images";
import { Button, Dropdown, Input, Notice, Text } from "@/components/ui";

type Picked = { uri: string; name: string; type: string };
const LIMIT = 10;

export default function NewPost() {
  const router = useRouter();
  const interests = useCategories();
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [pictures, setPictures] = useState<Picked[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pickAudio() {
    const result = await DocumentPicker.getDocumentAsync({ type: "audio/*", multiple: true, copyToCacheDirectory: true });
    if (result.canceled) return;
    setPictures((current) => [...current, ...result.assets.map((asset) => ({ uri: asset.uri, name: asset.name, type: asset.mimeType || "audio/mpeg" }))].slice(0, LIMIT));
  }

  async function pick(kind: "images" | "videos" = "images") {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: [kind], allowsMultipleSelection: true, selectionLimit: LIMIT, quality: 0.8 });
    if (result.canceled) return;
    const added: Picked[] = await Promise.all(
      result.assets.map(async (asset, index) =>
        kind === "images" ? prepareImage(asset) : { uri: asset.uri, name: asset.fileName || `video-${Date.now()}-${index}.mp4`, type: asset.mimeType || "video/mp4" },
      ),
    );
    setPictures((current) => [...current, ...added].slice(0, LIMIT));
  }

  async function publish() {
    if (!category) return setError("Choose an interest for your post.");
    if (!content.trim()) return setError("Write something to share.");
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("category_id", category);
      form.append("content", content.trim());
      form.append("visibility", "public");
      // React Native sends a file as { uri, name, type }; the server shrinks the pictures again.
      for (const picture of pictures) form.append("media", { uri: picture.uri, name: picture.name, type: picture.type } as any);
      await api("frontend/showcase", { method: "POST", form });
      router.back();
    } catch (problem: any) {
      setError(problem.status === 0 && pictures.length ? "Could not upload the attachments. Check your connection and try again." : problem.message);
      setBusy(false);
      if (problem.status === 403) Alert.alert("Not allowed", problem.message);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Input label="What do you want to share?" value={content} onChangeText={setContent} multiline placeholder="Your work, a thought, something you learned…" maxLength={5000} style={{ minHeight: 130 }} />

      <Dropdown label="Interest" value={category} placeholder="Choose an interest" options={interests.map((item) => ({ value: String(item.id), label: item.name }))} onChange={setCategory} />

      <Text style={styles.label}>Pictures, video or audio</Text>
      <View style={styles.row}>
        {pictures.map((picture, index) => (
          <View testID={`attachment-${index}`} key={picture.uri} style={styles.thumb}>
            {picture.type.startsWith("image/") ? (
              <Image source={{ uri: picture.uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : (
              <View style={styles.media}>
                <Ionicons name={picture.type.startsWith("video/") ? "videocam" : "musical-notes"} size={26} color={colors.green} />
                <Text style={{ fontSize: 10, color: colors.muted }} numberOfLines={1}>
                  {picture.name}
                </Text>
              </View>
            )}
            <Pressable style={styles.remove} onPress={() => setPictures((current) => current.filter((_, position) => position !== index))} accessibilityLabel="Remove attachment">
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
      </View>
      {pictures.length < LIMIT && (
        <View style={styles.row}>
          <Button label="Pictures" icon="image-outline" kind="soft" onPress={() => pick("images")} style={{ flex: 1 }} />
          <Button label="Video" icon="videocam-outline" kind="soft" onPress={() => pick("videos")} style={{ flex: 1 }} />
          <Button label="Audio" icon="musical-notes-outline" kind="soft" onPress={pickAudio} style={{ flex: 1 }} />
        </View>
      )}

      {error ? <Notice>{error}</Notice> : null}
      <Button label="Publish post" icon="send" onPress={publish} busy={busy} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14 },
  label: { fontSize: 13, fontWeight: "700", color: colors.text },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  media: { flex: 1, alignItems: "center", justifyContent: "center", padding: 4, gap: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" },
  chipOn: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  chipText: { color: colors.muted, fontWeight: "700" },
  thumb: { width: 84, height: 84, borderRadius: 12, overflow: "hidden", backgroundColor: "#e9efeb" },
  add: { alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.green, backgroundColor: colors.greenSoft },
  remove: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
});
