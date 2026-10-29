import { Redirect, Tabs, useRouter } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/config";
import { useAuth } from "@/lib/auth";
import { useLive } from "@/lib/realtime";
import { IconButton, LogoMark, Text, type IconName } from "@/components/ui";

/** Search, messages and notifications: the same three buttons at the top right of every tab. */
function HeaderButtons() {
  const router = useRouter();
  const { messages, notifications } = useLive();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingRight: 8 }}>
      <IconButton icon="search-outline" label="Search" onPress={() => router.push("/search")} />
      <IconButton icon="chatbubble-ellipses-outline" label="Messages" badge={messages} onPress={() => router.push("/messages")} />
      <IconButton icon="notifications-outline" label="Notifications" badge={notifications} onPress={() => router.push("/notifications")} />
    </View>
  );
}

function HeaderTitle({ children }: { children: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <LogoMark size={28} />
      <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.4 }}>{children}</Text>
    </View>
  );
}

type Item = { name: string; title: string; icon: IconName; focused: IconName; roles: string[] };
const ITEMS: Item[] = [
  { name: "index", title: "Dashboard", icon: "grid-outline", focused: "grid", roles: ["learner", "hirer"] },
  { name: "showcase", title: "Showcase", icon: "sparkles-outline", focused: "sparkles", roles: ["learner", "hirer"] },
  { name: "leaderboard", title: "Leaderboard", icon: "medal-outline", focused: "medal", roles: ["hirer"] },
  { name: "courses", title: "Courses", icon: "book-outline", focused: "book", roles: ["learner"] },
  { name: "events", title: "Events", icon: "trophy-outline", focused: "trophy", roles: ["learner"] },
  { name: "jobs", title: "Jobs", icon: "briefcase-outline", focused: "briefcase", roles: ["learner"] },
  { name: "hiring", title: "Hiring", icon: "people-outline", focused: "people", roles: ["hirer"] },
  { name: "profile", title: "Profile", icon: "person-outline", focused: "person", roles: ["learner", "hirer"] },
];

export default function TabsLayout() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const role = user?.role || "learner";
  if (role === "learner" && user?.interests && user.interests.length === 0) return <Redirect href="/interests" />;
  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "left",
        headerStyle: { backgroundColor: colors.card },
        headerShadowVisible: false,
        headerRight: () => <HeaderButtons />,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: "#8a9890",
        tabBarLabelStyle: { fontSize: 11, fontFamily: "Figtree_700Bold" },
        // The bar sits above the phone's own navigation buttons or gesture line.
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 58 + insets.bottom, paddingBottom: insets.bottom + 4, paddingTop: 6 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      {ITEMS.map((item) => (
        <Tabs.Screen
          key={item.name}
          name={item.name}
          options={{
            title: item.title,
            href: item.roles.includes(role) ? undefined : null,
            headerTitle: () => <HeaderTitle>{item.title}</HeaderTitle>,
            tabBarIcon: ({ color, focused, size }) => <Ionicons name={focused ? item.focused : item.icon} size={size} color={color as string} />,
          }}
        />
      ))}
    </Tabs>
  );
}
