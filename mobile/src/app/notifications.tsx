import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { colors } from "@/lib/config";
import { usePaged } from "@/lib/hooks";
import { ago } from "@/lib/format";
import { routeFor } from "@/lib/links";
import { useLive, useSocketEvent } from "@/lib/realtime";
import { Avatar, Dropdown, Empty, ErrorBox, Loading, Muted, Text } from "@/components/ui";

type Note = { id: string; type: string; category: string; title: string; body: string | null; link: string | null; read: boolean; created_at: string; actor_id: string | null; actor_name: string | null; actor_has_picture: boolean };

const categoryIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
  social: "heart-outline",
  jobs: "briefcase-outline",
  contests: "trophy-outline",
  courses: "book-outline",
  webinars: "videocam-outline",
  communities: "people-outline",
  system: "megaphone-outline",
  admin: "shield-outline",
};

export default function Notifications() {
  const router = useRouter();
  const { refreshCounts } = useLive();
  const [category, setCategory] = useState("");
  const [filter, setFilter] = useState("");
  const list = usePaged<Note>(`frontend/notifications?category=${category}&filter=${filter}`, 20);

  useSocketEvent("notification", () => list.reload());
  useEffect(() => () => refreshCounts(), [refreshCounts]);

  async function open(note: Note) {
    if (!note.read) {
      list.setItems((items) => items.map((item) => (item.id === note.id ? { ...item, read: true } : item)));
      api(`frontend/notifications/${note.id}`, { method: "PATCH", body: { read: true } }).then(refreshCounts).catch(() => {});
    }
    const route = routeFor(note.link);
    if (route) router.push(route);
  }

  async function readAll() {
    list.setItems((items) => items.map((item) => ({ ...item, read: true })));
    await api("frontend/notifications/read-all", { method: "POST", body: {} }).catch(() => {});
    refreshCounts();
  }

  const unread = list.items.some((item) => !item.read);

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerRight: () => (unread ? <Text onPress={readAll} style={styles.readAll}>Mark all read</Text> : null) }} />
      <View style={styles.filters}>
        <Dropdown compact icon="funnel-outline" value={category} placeholder="All categories" options={[{ value: "", label: "All categories" }, ...Object.keys(categoryIcon).filter((key) => key !== "admin").map((key) => ({ value: key, label: key[0].toUpperCase() + key.slice(1) }))]} onChange={setCategory} />
        <Dropdown compact value={filter} placeholder="All" options={[{ value: "", label: "All" }, { value: "unread", label: "Unread only" }]} onChange={setFilter} />
      </View>
      {list.loading ? (
        <Loading />
      ) : list.error && !list.items.length ? (
        <ErrorBox message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(note) => note.id}
          contentContainerStyle={{ paddingBottom: 30 }}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.6}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          ListEmptyComponent={<Empty icon="notifications-outline" title="You’re all caught up" text="New activity will show up here." />}
          ListFooterComponent={list.loadingMore ? <Loading /> : undefined}
          renderItem={({ item }) => (
            <Pressable testID={`notification-${item.id}`} onPress={() => open(item)} style={[styles.row, !item.read && styles.unread]} android_ripple={{ color: colors.greenSoft }}>
              {item.actor_id ? (
                <Avatar id={item.actor_id} name={item.actor_name} hasPicture={item.actor_has_picture} size={42} />
              ) : (
                <View style={styles.icon}>
                  <Ionicons name={categoryIcon[item.category] || "notifications-outline"} size={20} color={colors.green} />
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.title, !item.read && { fontWeight: "800" }]}>{item.title}</Text>
                {item.body ? (
                  <Muted numberOfLines={2}>{item.body}</Muted>
                ) : null}
                <Muted>{ago(item.created_at)}</Muted>
              </View>
              {!item.read ? <View style={styles.dot} /> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: "row", gap: 8, padding: 12, paddingBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.card },
  unread: { backgroundColor: "#f1f8f4" },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orange },
  readAll: { color: colors.green, fontWeight: "800", fontSize: 13, paddingRight: 6 },
});
