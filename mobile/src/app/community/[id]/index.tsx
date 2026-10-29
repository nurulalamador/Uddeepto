import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { colors } from "@/lib/config";
import { useApi } from "@/lib/hooks";
import { count } from "@/lib/format";
import { Button, Card, Chip, ErrorBox, Loading, Muted, Notice, SectionTitle, Text } from "@/components/ui";

type Community = {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  requires_approval: boolean;
  creator_name: string;
  member_count: string | number;
  membership: "approved" | "pending" | "rejected" | null;
  role: string | null;
  category_details?: { id: string; name: string }[];
  chats: { id: string; name: string; description: string | null }[];
};

export default function CommunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const community = useApi<Community>(`frontend/communities/${id}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const data = community.data;

  async function join() {
    setBusy(true);
    setError("");
    try {
      await api(`communities/${id}/join`, { method: "POST" });
      await community.reload();
    } catch (problem: any) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    Alert.alert("Leave this community?", "You can join again later.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          try {
            await api(`frontend/communities/${id}/membership`, { method: "DELETE" });
            router.back();
          } catch (problem: any) {
            setError(problem.message);
          }
        },
      },
    ]);
  }

  if (community.loading) return <Loading />;
  if (!data) return <ErrorBox message={community.error || "This community is not available."} onRetry={community.reload} />;
  const member = data.membership === "approved";

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Card>
        <View style={styles.chips}>
          {data.is_private ? <Chip label="Private" tone="orange" icon="lock-closed-outline" /> : null}
          {member ? <Chip label={data.role === "owner" ? "Owner" : "Member"} icon="checkmark-circle" /> : null}
          {data.membership === "pending" ? <Chip label="Request sent" tone="orange" /> : null}
        </View>
        <Text style={styles.name}>{data.name}</Text>
        {data.description ? <Text style={styles.text}>{data.description}</Text> : null}
        <Muted>
          {count(data.member_count)} member{count(data.member_count) === 1 ? "" : "s"} · created by {data.creator_name}
        </Muted>
        {data.category_details?.length ? (
          <View style={styles.chips}>
            {data.category_details.map((category) => (
              <Chip key={category.id} label={category.name} />
            ))}
          </View>
        ) : null}
      </Card>
      {error ? <Notice>{error}</Notice> : null}

      {member ? (
        <>
          <SectionTitle>Channels</SectionTitle>
          {data.chats.map((chat) => (
            <Card key={chat.id} onPress={() => router.push({ pathname: "/community/[id]/[chatId]", params: { id: data.id, chatId: chat.id, name: chat.name } })} style={styles.channel}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.green} />
              <View style={{ flex: 1 }}>
                <Text style={styles.channelName}># {chat.name}</Text>
                {chat.description ? <Muted numberOfLines={1}>{chat.description}</Muted> : null}
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Card>
          ))}
          {data.role !== "owner" && <Button label="Leave community" kind="secondary" icon="exit-outline" onPress={leave} />}
        </>
      ) : data.membership === "pending" ? (
        <Notice tone="success">Your request is waiting for approval.</Notice>
      ) : (
        <Button label={data.requires_approval ? "Request to join" : "Join community"} icon="people-outline" onPress={join} busy={busy} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 14, gap: 12, paddingBottom: 30 },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  name: { fontSize: 18, fontWeight: "800", color: colors.text },
  text: { color: colors.text, fontSize: 14, lineHeight: 21 },
  channel: { flexDirection: "row", alignItems: "center", gap: 12 },
  channelName: { fontWeight: "800", color: colors.text, fontSize: 15 },
});
