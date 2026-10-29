import { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/lib/auth";
import { colors, gradients, radius, shadow } from "@/lib/config";
import { useApi, useCategories } from "@/lib/hooks";
import { Avatar, Button, Card, Dropdown, Empty, ErrorBox, Loading, Muted, Text } from "./ui";

export type Entry = { id: string; name: string; username: string; uddeepto_id: string; has_picture: boolean; total: number; courses: number; contests: number; rank: number };
type Board = { items: Entry[]; me: Entry | null; total: number };

const MEDAL = ["#d9a420", "#8c98a4", "#b9733d"];

function Row({ entry, mine }: { entry: Entry; mine: boolean }) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push(`/user/${entry.uddeepto_id}`)} style={[styles.row, mine && styles.rowMine]} accessibilityRole="button">
      <View style={[styles.rank, entry.rank <= 3 && { backgroundColor: MEDAL[entry.rank - 1] }]}>
        <Text style={[styles.rankText, entry.rank <= 3 && { color: "#fff" }]}>#{entry.rank}</Text>
      </View>
      <Avatar id={entry.id} name={entry.name} hasPicture={entry.has_picture} size={42} />
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.name}
          {mine ? " (you)" : ""}
        </Text>
        <Muted numberOfLines={1}>@{entry.username}</Muted>
      </View>
      <Text style={[styles.points, entry.total < 0 && { color: colors.red }]}>
        {entry.total}
        <Text style={styles.pts}> pts</Text>
      </Text>
    </Pressable>
  );
}

/** The top three learners and a button to the complete leaderboard (learner dashboard). */
export function LeaderboardPreview() {
  const router = useRouter();
  const { user } = useAuth();
  const board = useApi<Board>("frontend/leaderboard?limit=3");
  const items = board.data?.items || [];
  return (
    <Card>
      <View style={styles.head}>
        <Ionicons name="medal-outline" size={20} color={colors.orange} />
        <Text style={styles.title}>Leaderboard</Text>
      </View>
      {board.loading ? <Loading /> : items.length ? items.map((entry) => <Row key={entry.id} entry={entry} mine={entry.id === user?.id} />) : <Muted>Finish courses and contests to appear here.</Muted>}
      <Button label="Complete leaderboard" icon="arrow-forward" kind="soft" onPress={() => router.push("/leaderboard-full")} />
    </Card>
  );
}

/** Everyone ranked by points, filtered by the interest a learner chose in their profile. */
export function LeaderboardList() {
  const { user } = useAuth();
  const categories = useCategories();
  const [category, setCategory] = useState("");
  const board = useApi<Board>(`frontend/leaderboard?limit=100&category=${category}`);
  const data = board.data;

  const header = (
    <View style={{ gap: 12 }}>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Text style={styles.heroEyebrow}>LEADERBOARD</Text>
        <Text style={styles.heroTitle}>Top learners</Text>
        <Text style={styles.heroText}>Points are calculated from contest and course performance.</Text>
        {data?.me ? (
          <View style={styles.me}>
            <Ionicons name="ribbon-outline" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "700", flex: 1 }}>
              Your position: #{data.me.rank} of {data.total}
            </Text>
            <Text style={{ color: "#fff", fontWeight: "800" }}>{data.me.total} pts</Text>
          </View>
        ) : null}
      </LinearGradient>
      <Dropdown icon="funnel-outline" value={category} placeholder="All interests" options={[{ value: "", label: "All interests" }, ...categories.map((item) => ({ value: String(item.id), label: item.name }))]} onChange={setCategory} searchable />
    </View>
  );

  if (board.loading && !data) return <Loading />;
  if (board.error && !data) return <ErrorBox message={board.error} onRetry={board.reload} />;
  return (
    <FlatList
      data={data?.items || []}
      keyExtractor={(entry) => entry.id}
      contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 30 }}
      ListHeaderComponent={header}
      ListEmptyComponent={<Empty icon="medal-outline" title="No learners here yet" text="Nobody with this interest has points yet." />}
      refreshControl={<RefreshControl refreshing={board.refreshing} onRefresh={board.refresh} tintColor={colors.green} />}
      renderItem={({ item }) => <Row entry={item} mine={item.id === user?.id} />}
    />
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 16, fontWeight: "800", color: colors.text },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  rowMine: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  rank: { minWidth: 40, height: 32, borderRadius: 10, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  rankText: { fontWeight: "800", color: colors.green, fontSize: 13 },
  name: { fontWeight: "800", color: colors.text, fontSize: 15 },
  points: { fontWeight: "800", color: colors.green, fontSize: 17 },
  pts: { fontSize: 11, fontWeight: "600", color: colors.muted },
  hero: { borderRadius: radius.xl, padding: 18, gap: 6, ...shadow },
  heroEyebrow: { color: colors.orangeLight, fontWeight: "800", fontSize: 12, letterSpacing: 1.2 },
  heroTitle: { color: "#fff", fontSize: 24, fontWeight: "800", letterSpacing: -0.6 },
  heroText: { color: "rgba(255,255,255,0.85)", lineHeight: 20 },
  me: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, padding: 10, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.18)" },
});
