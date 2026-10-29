import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Ionicons } from "@expo/vector-icons";
import { authHeaders, fileUrl } from "@/lib/api";
import { colors } from "@/lib/config";
import { Text } from "./text";

/** A video (or audio file) from the API, played inside the app with the person's token sent along. */
export function MediaPlayer({ path, audio = false, name, onPlayStart }: { path: string; audio?: boolean; name?: string; onPlayStart?: () => void }) {
  const player = useVideoPlayer({ uri: fileUrl(path), headers: authHeaders() }, (instance) => {
    instance.loop = false;
  });
  const [error, setError] = useState("");
  useEffect(() => {
    const status = player.addListener("statusChange", (event: any) => {
      if (event.status === "error") setError(event.error?.message || "This file could not be played.");
    });
    const playing = player.addListener("playingChange", (event: any) => {
      if (event.isPlaying) onPlayStart?.();
    });
    return () => {
      status.remove();
      playing.remove();
    };
  }, [player, onPlayStart]);

  return (
    <View style={[styles.box, audio && { aspectRatio: undefined, height: 96, backgroundColor: colors.greenDark }]}>
      <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls contentFit="contain" fullscreenOptions={{ enable: !audio }} />
      {audio ? (
        <View style={styles.audioLabel} pointerEvents="none">
          <Ionicons name="musical-notes" size={18} color={colors.orangeLight} />
          <Text style={{ color: "#fff", fontWeight: "700", flex: 1 }} numberOfLines={1}>
            {name || "Audio"}
          </Text>
        </View>
      ) : null}
      {error ? (
        <View style={styles.error}>
          <Ionicons name="alert-circle-outline" size={22} color="#fff" />
          <Text style={{ color: "#fff", textAlign: "center" }}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", borderRadius: 14, overflow: "hidden" },
  audioLabel: { position: "absolute", top: 10, left: 12, right: 12, flexDirection: "row", gap: 8, alignItems: "center" },
  error: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", gap: 6, padding: 16 },
});
