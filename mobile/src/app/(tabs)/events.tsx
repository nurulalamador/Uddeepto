import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "@/lib/config";
import { useCategories, useDebounced, usePaged } from "@/lib/hooks";
import { count, dateTime, label, money } from "@/lib/format";
import { EventSummary, type Category, type Speaker } from "@/components/event";
import { Card, Chip, Dropdown, Empty, ErrorBox, FilterBar, Loading, Muted, Pills, TopTabs, Text } from "@/components/ui";

type Kind = "contests" | "webinars";
type Phase = "ongoing" | "upcoming" | "previous";
type EventRow = {
  id: string;
  name: string;
  description?: string;
  status: string;
  type?: string;
  entry_fee?: string;
  currency?: string;
  capacity?: number | null;
  starting_time: string;
  ending_time: string;
  category_name?: string;
  participant_count: string | number;
  joined: boolean;
  speakers?: Speaker[];
  category_details?: Category[];
};

export default function EventsTab() {
  const [kind, setKind] = useState<Kind>("contests");
  return (
    <View style={{ flex: 1 }}>
      <TopTabs
        tabs={[
          { value: "contests", label: "Contest" },
          { value: "webinars", label: "Webinar" },
        ]}
        value={kind}
        onChange={setKind}
      />
      <EventList key={kind} kind={kind} />
    </View>
  );
}

function EventList({ kind }: { kind: Kind }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("ongoing");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const query = useDebounced(text.trim());
  const categories = useCategories();
  const list = usePaged<EventRow>(`frontend/catalog/${kind}?tab=${phase}&q=${encodeURIComponent(query)}&category=${category}`);
  const single = kind === "contests" ? "contest" : "webinar";

  return (
    <View style={{ flex: 1 }}>
      <FilterBar value={text} onChangeText={setText} placeholder={`Search ${kind}…`}>
        <Dropdown compact icon="funnel-outline" value={category} placeholder="All interests" options={[{ value: "", label: "All interests" }, ...categories.map((item) => ({ value: String(item.id), label: item.name }))]} onChange={setCategory} />
      </FilterBar>
      <Pills
        items={[
          { value: "ongoing", label: "Ongoing" },
          { value: "upcoming", label: "Upcoming" },
          { value: "previous", label: "Previous" },
        ]}
        value={phase}
        onChange={setPhase}
      />
      {list.loading ? (
        <Loading />
      ) : list.error && !list.items.length ? (
        <ErrorBox message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(event) => event.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.6}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          ListEmptyComponent={<Empty icon={kind === "contests" ? "trophy-outline" : "videocam-outline"} title={`No ${phase} ${kind}`} text="Check the other tabs or come back later." />}
          ListFooterComponent={list.loadingMore ? <Loading /> : undefined}
          renderItem={({ item }) => (
            <Card testID={`event-card-${item.id}`} onPress={() => router.push(`/${single}/${item.id}`)}>
              <EventSummary
                title={item.name}
                start={item.starting_time}
                end={item.ending_time}
                ended={phase === "previous"}
                categories={item.category_details}
                fallbackCategory={item.category_name}
                speakers={item.speakers}
                chips={
                  <>
                    <Chip label={phase === "ongoing" ? (kind === "contests" ? "Live now" : "Happening now") : label(phase)} tone={phase === "ongoing" ? "orange" : phase === "upcoming" ? "green" : "gray"} />
                    {item.status === "cancelled" ? <Chip label="Cancelled" tone="red" /> : null}
                    {item.joined ? <Chip label={kind === "contests" ? "Joined" : "Registered"} icon="checkmark-circle" /> : null}
                  </>
                }
                footer={
                  <>
                    <Muted>
                      {count(item.participant_count)} {kind === "contests" ? "participants" : item.capacity ? `of ${item.capacity} seats` : "registered"}
                    </Muted>
                    {kind === "contests" ? <Text style={styles.fee}>{money(item.entry_fee, item.currency)}</Text> : null}
                  </>
                }
              />
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 14, paddingBottom: 30 },
  chips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  title: { fontSize: 16, fontWeight: "800", color: colors.text },
  foot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  fee: { color: colors.orange, fontWeight: "800" },
});
