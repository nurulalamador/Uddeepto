import { useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/lib/api";
import { colors } from "@/lib/config";
import { useApi } from "@/lib/hooks";
import { EventHero, type Category } from "@/components/event";
import { count, dateTime, label } from "@/lib/format";
import { Avatar, Button, Card, Chip, ErrorBox, Loading, Muted, Notice, Text } from "@/components/ui";

type Webinar = {
  id: string;
  name: string;
  description: string;
  status: string;
  capacity: number | null;
  starting_time: string;
  ending_time: string;
  recording_url: string | null;
  meeting_url: string | null;
  category_name?: string;
  category_details?: Category[];
  creator_name?: string;
  participant_count: string | number;
  joined: boolean;
  phase: "upcoming" | "ongoing" | "previous";
  speakers: { id: string; name: string; designation?: string; has_image?: boolean }[];
};

export default function WebinarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const webinar = useApi<Webinar>(`frontend/webinars/${id}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const data = webinar.data;

  async function join() {
    setBusy(true);
    setError("");
    try {
      await api(`frontend/webinars/${id}/join`, { method: "POST" });
      await webinar.reload();
    } catch (problem: any) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  const open = (url: string) => Linking.openURL(url).catch(() => setError("The link could not be opened."));

  if (webinar.loading) return <Loading />;
  if (!data) return <ErrorBox message={webinar.error || "This webinar is not available."} onRetry={webinar.reload} />;
  const registered = count(data.participant_count);
  const full = data.capacity != null && registered >= data.capacity && !data.joined;
  const bookable = data.phase !== "previous" && ["scheduled", "live"].includes(data.status);

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <EventHero
        eyebrow="WEBINAR"
        title={data.name}
        description={data.description}
        start={data.starting_time}
        end={data.ending_time}
        categories={data.category_details}
        fallbackCategory={data.category_name}
        chips={
          <>
            <Chip label={data.phase === "ongoing" ? "Happening now" : label(data.phase)} tone={data.phase === "ongoing" ? "orange" : data.phase === "upcoming" ? "green" : "gray"} />
            {data.status === "cancelled" ? <Chip label="Cancelled" tone="red" /> : null}
            {data.joined ? <Chip label="Registered" icon="checkmark-circle" /> : null}
          </>
        }
        facts={[{ icon: "people-outline", text: `${registered} registered${data.capacity ? ` · ${data.capacity} seats` : ""}` }, ...(data.creator_name ? [{ icon: "person-outline" as const, text: `By ${data.creator_name}` }] : [])]}
      />

      {data.speakers?.length > 0 && (
        <Card>
          <Text style={styles.name}>Speakers</Text>
          {data.speakers.map((speaker) => (
            <Pressable key={speaker.id} style={styles.speakerRow} onPress={() => router.push(`/instructor/${speaker.id}`)}>
              <Avatar id={speaker.id} name={speaker.name} hasPicture={speaker.has_image} size={52} instructor />
              <View style={{ flex: 1 }}>
                <Text style={styles.speaker}>{speaker.name}</Text>
                {speaker.designation ? <Muted>{speaker.designation}</Muted> : null}
              </View>
            </Pressable>
          ))}
        </Card>
      )}

      {error ? <Notice>{error}</Notice> : null}

      {!data.joined && bookable && (full ? <Notice>All seats are taken.</Notice> : <Button label="Reserve my seat" icon="bookmark-outline" onPress={join} busy={busy} />)}
      {data.joined && data.meeting_url && data.phase !== "previous" && <Button label="Join the meeting" icon="videocam-outline" onPress={() => open(data.meeting_url as string)} />}
      {data.joined && !data.meeting_url && data.phase !== "previous" && <Muted style={{ textAlign: "center" }}>The meeting link appears here shortly before the webinar starts.</Muted>}
      {data.recording_url && <Button label="Watch the recording" icon="play-circle-outline" kind="secondary" onPress={() => open(data.recording_url as string)} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 14, gap: 12, paddingBottom: 30 },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  name: { fontSize: 16, fontWeight: "800", color: colors.text },
  text: { color: colors.text, fontSize: 14, lineHeight: 21 },
  speakerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  speaker: { fontWeight: "700", color: colors.text },
});
