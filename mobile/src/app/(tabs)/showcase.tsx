import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/lib/config";
import { useCategories, useDebounced, usePaged } from "@/lib/hooks";
import { Dropdown, Empty, ErrorBox, FilterBar, Loading, Text } from "@/components/ui";
import { PostCard, type Post } from "@/components/post-card";

export default function ShowcaseTab() {
  const router = useRouter();
  const navigation = useNavigation();
  const [category, setCategory] = useState("");
  const [text, setText] = useState("");
  const query = useDebounced(text.trim());
  const categories = useCategories();
  const feed = usePaged<Post>(`frontend/showcase?category=${category}&q=${encodeURIComponent(query)}`);
  const { reload } = feed;

  // Returning from the composer or a post refreshes the retained tab's feed.
  useEffect(() => navigation.addListener("focus", () => { void reload(); }), [navigation, reload]);

  return (
    <View style={{ flex: 1 }}>
      <FilterBar value={text} onChangeText={setText} placeholder="Search posts…">
        <Dropdown compact icon="funnel-outline" value={category} placeholder="All interests" options={[{ value: "", label: "All interests" }, ...categories.map((item) => ({ value: String(item.id), label: item.name }))]} onChange={setCategory} />
      </FilterBar>

      {feed.loading ? (
        <Loading />
      ) : feed.error && !feed.items.length ? (
        <ErrorBox message={feed.error} onRetry={feed.reload} />
      ) : (
        <FlatList
          data={feed.items}
          keyExtractor={(post) => post.id}
          renderItem={({ item }) => <PostCard post={item} onDeleted={feed.reload} />}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onEndReached={feed.loadMore}
          onEndReachedThreshold={0.6}
          refreshing={feed.refreshing}
          onRefresh={feed.refresh}
          ListEmptyComponent={<Empty icon="sparkles-outline" title="Nothing here yet" text={query || category ? "No posts match these filters." : "Be the first to share something with the community."} />}
          ListFooterComponent={feed.loadingMore ? <Loading /> : feed.items.length > 4 && !feed.hasMore ? <Text style={styles.end}>You’re all caught up.</Text> : undefined}
        />
      )}

      <Pressable style={styles.fab} onPress={() => router.push("/new-post")} accessibilityRole="button" accessibilityLabel="Create a post">
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 14, paddingBottom: 96 },
  end: { textAlign: "center", color: colors.muted, padding: 18 },
  fab: { position: "absolute", right: 18, bottom: 18, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", elevation: 5, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
});
