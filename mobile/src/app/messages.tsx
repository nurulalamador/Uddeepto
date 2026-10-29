import { useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { colors } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import { useApi, useCategories, useDebounced, usePaged } from "@/lib/hooks";
import { ago, count } from "@/lib/format";
import { useLive, useSocketEvent } from "@/lib/realtime";
import { Avatar, Button, Card, Chip, Dropdown, Empty, ErrorBox, FilterBar, Loading, Muted, SectionTitle, TopTabs, Text, TextInput } from "@/components/ui";

type Conversation = { id: string; updated_at: string; name: string; other_user_id: string; other_has_picture: boolean; last_message: string | null };
type Person = { id: string; name: string; username: string; role: string; has_picture: boolean };
type Mine = { id: string; name: string; description: string | null; member_count: string | number; channel_count: string | number; role: string };
type Explore = { id: string; name: string; description: string | null; is_private: boolean; member_count: string | number; membership: string | null };

export default function Messages() {
  const { messages } = useLive();
  const { user } = useAuth();
  const [tab, setTab] = useState<"inbox" | "community">("inbox");
  // Hirers only have the inbox; communities are for learners.
  if (user?.role !== "learner") return <Inbox />;
  return (
    <View style={{ flex: 1 }}>
      <TopTabs
        tabs={[
          { value: "inbox", label: "Inbox", badge: messages },
          { value: "community", label: "Community" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "inbox" ? <Inbox /> : <Communities />}
    </View>
  );
}

function Inbox() {
  const router = useRouter();
  const { unreadConversations, refreshCounts } = useLive();
  const list = useApi<Conversation[]>("frontend/messages");
  const [composing, setComposing] = useState(false);

  useSocketEvent("message:new", () => {
    list.reload();
    refreshCounts();
  });

  if (composing) return <NewMessage onClose={() => setComposing(false)} />;
  if (list.loading) return <Loading />;
  if (list.error && !list.data) return <ErrorBox message={list.error} onRetry={list.reload} />;

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={list.data || []}
        keyExtractor={(conversation) => conversation.id}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 90 }}
        ListEmptyComponent={<Empty icon="chatbubble-ellipses-outline" title="No conversations yet" text="Start one with the button below, or from someone’s profile." />}
        renderItem={({ item }) => {
          const unread = unreadConversations.includes(item.id);
          return (
            <Card onPress={() => router.push(`/chat/${item.id}`)} style={styles.row}>
              <Avatar id={item.other_user_id} name={item.name} hasPicture={item.other_has_picture} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, unread && { color: colors.green }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Muted numberOfLines={1}>{item.last_message || "No messages yet"}</Muted>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Muted>{ago(item.updated_at)}</Muted>
                {unread ? <View style={styles.dot} /> : null}
              </View>
            </Card>
          );
        }}
      />
      <Pressable style={styles.fab} onPress={() => setComposing(true)} accessibilityRole="button" accessibilityLabel="New message">
        <Ionicons name="create-outline" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

function NewMessage({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const query = useDebounced(text.trim());
  const people = useApi<Person[]>(query.length >= 2 ? `frontend/people?q=${encodeURIComponent(query)}` : null);
  const [error, setError] = useState("");

  async function start(person: Person) {
    setError("");
    try {
      const conversation = await api<{ id: string }>("frontend/messages", { method: "POST", body: { user_id: person.id } });
      onClose();
      router.push(`/chat/${conversation.id}`);
    } catch (problem: any) {
      setError(problem.message);
    }
  }

  return (
    <View style={{ flex: 1, padding: 14, gap: 10 }}>
      <View style={styles.search}>
        <Ionicons name="search-outline" size={18} color={colors.muted} />
        <TextInput autoFocus value={text} onChangeText={setText} placeholder="Search for a person…" placeholderTextColor="#9aa7a0" style={styles.searchInput} autoCorrect={false} />
        <Text style={styles.cancel} onPress={onClose}>
          Cancel
        </Text>
      </View>
      {error ? <Muted style={{ color: colors.red }}>{error}</Muted> : null}
      {query.length < 2 ? (
        <Muted style={{ textAlign: "center", padding: 20 }}>Type at least two letters of a name.</Muted>
      ) : people.loading ? (
        <Loading />
      ) : (
        <FlatList
          data={(people.data || []).filter((person) => person.role !== "admin")}
          keyExtractor={(person) => person.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 8 }}
          ListEmptyComponent={<Empty icon="person-outline" title="Nobody found" />}
          renderItem={({ item }) => (
            <Card onPress={() => start(item)} style={styles.row}>
              <Avatar id={item.id} name={item.name} hasPicture={item.has_picture} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Muted>@{item.username}</Muted>
              </View>
            </Card>
          )}
        />
      )}
    </View>
  );
}

function Communities() {
  const router = useRouter();
  const mine = useApi<Mine[]>("frontend/communities/mine");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const query = useDebounced(text.trim());
  const categories = useCategories();
  const explore = usePaged<Explore>(`frontend/catalog/communities?tab=explore&q=${encodeURIComponent(query)}&category=${category}`, 10);
  const [error, setError] = useState("");
  const mineRows = (mine.data || []).filter((item) => !query || item.name.toLowerCase().includes(query.toLowerCase()));

  async function join(community: Explore) {
    setError("");
    try {
      await api(`communities/${community.id}/join`, { method: "POST" });
      await Promise.all([mine.reload(), explore.reload()]);
    } catch (problem: any) {
      setError(problem.message);
    }
  }

  if (mine.loading) return <Loading />;
  if (mine.error && !mine.data) return <ErrorBox message={mine.error} onRetry={mine.reload} />;

  return (
    <View style={{ flex: 1 }}>
    <FilterBar value={text} onChangeText={setText} placeholder="Search communities…">
      <Dropdown compact icon="funnel-outline" value={category} placeholder="All interests" options={[{ value: "", label: "All interests" }, ...categories.map((item) => ({ value: String(item.id), label: item.name }))]} onChange={setCategory} />
    </FilterBar>
    <FlatList
      data={mineRows}
      keyExtractor={(community) => community.id}
      refreshing={mine.refreshing}
      onRefresh={() => {
        mine.refresh();
        explore.reload();
      }}
      contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 30 }}
      ListEmptyComponent={<Muted style={{ textAlign: "center", padding: 16 }}>You have not joined a community yet.</Muted>}
      renderItem={({ item }) => (
        <Card onPress={() => router.push(`/community/${item.id}`)} style={styles.row}>
          <View style={styles.icon}>
            <Ionicons name="people" size={22} color={colors.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <Muted>
              {count(item.member_count)} members · {count(item.channel_count)} channel{count(item.channel_count) === 1 ? "" : "s"}
            </Muted>
          </View>
          {item.role === "owner" ? <Chip label="Owner" tone="orange" /> : null}
        </Card>
      )}
      ListFooterComponent={
        explore.items.length ? (
          <View style={{ gap: 10, marginTop: 14 }}>
            <SectionTitle>Discover communities</SectionTitle>
            {error ? <Muted style={{ color: colors.red }}>{error}</Muted> : null}
            {explore.items.map((community) => (
              <Card key={community.id} onPress={() => router.push(`/community/${community.id}`)}>
                <Text style={styles.name}>{community.name}</Text>
                {community.description ? <Muted numberOfLines={2}>{community.description}</Muted> : null}
                <View style={styles.discover}>
                  <Muted>
                    {count(community.member_count)} members{community.is_private ? " · Private" : ""}
                  </Muted>
                  {community.membership === "pending" ? <Chip label="Request sent" tone="orange" /> : <Button label="Join" kind="secondary" onPress={() => join(community)} style={{ minHeight: 36, paddingHorizontal: 14 }} />}
                </View>
              </Card>
            ))}
          </View>
        ) : undefined
      }
    />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontWeight: "800", color: colors.text, fontSize: 15 },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.orange },
  fab: { position: "absolute", right: 18, bottom: 18, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", elevation: 5 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" },
  searchInput: { flex: 1, minHeight: 46, fontSize: 16, color: colors.text },
  cancel: { color: colors.green, fontWeight: "800" },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" },
  discover: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
});
