import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts, Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold } from "@expo-google-fonts/figtree";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LiveProvider } from "@/lib/realtime";
import { colors } from "@/lib/config";

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, failed] = useFonts({ Figtree_400Regular, Figtree_500Medium, Figtree_600SemiBold, Figtree_700Bold, Figtree_800ExtraBold });
  useEffect(() => {
    if (loaded || failed) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, failed]);
  if (!loaded && !failed) return null;
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <LiveProvider>
          <StatusBar style="dark" />
          <Gate />
        </LiveProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const pushed = { headerTintColor: colors.green, headerTitleStyle: { color: colors.text, fontFamily: "Figtree_800ExtraBold" }, headerStyle: { backgroundColor: colors.card }, headerShadowVisible: false };

function Gate() {
  const { status, user } = useAuth();
  const insets = useSafeAreaInsets();
  if (status === "loading")
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.green} size="large" />
      </View>
    );
  const member = status === "signedIn" && (user?.role === "learner" || user?.role === "hirer");
  const learner = member && user?.role === "learner";
  return (
    <Stack screenOptions={{ ...pushed, contentStyle: { backgroundColor: colors.bg, paddingBottom: insets.bottom } }}>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={member}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, contentStyle: { backgroundColor: colors.bg, paddingBottom: 0 } }} />
        <Stack.Screen name="search" options={{ title: "Search" }} />
        <Stack.Screen name="notifications" options={{ title: "Notifications" }} />
        <Stack.Screen name="messages" options={{ title: "Messages" }} />
        <Stack.Screen name="chat/[id]" options={{ title: "Chat" }} />
        <Stack.Screen name="community/[id]/index" options={{ title: "Community" }} />
        <Stack.Screen name="community/[id]/[chatId]" options={{ title: "Channel" }} />
        <Stack.Screen name="post/[id]" options={{ title: "Post" }} />
        <Stack.Screen name="new-post" options={{ title: "New post", presentation: "modal" }} />
        <Stack.Screen name="user/[ref]" options={{ title: "Profile" }} />
        <Stack.Screen name="edit-profile" options={{ title: "Edit profile" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="job/[id]" options={{ title: "Job" }} />
        <Stack.Screen name="ai" options={{ title: "Ask AI" }} />
      </Stack.Protected>
      <Stack.Protected guard={learner}>
        <Stack.Screen name="interests" options={{ title: "Your interests" }} />
        <Stack.Screen name="contest/[id]" options={{ title: "Contest" }} />
        <Stack.Screen name="webinar/[id]" options={{ title: "Webinar" }} />
        <Stack.Screen name="course/[id]/index" options={{ title: "Course" }} />
        <Stack.Screen name="course/[id]/[materialId]" options={{ title: "Material" }} />
        <Stack.Screen name="instructor/[id]" options={{ title: "Instructor" }} />
        <Stack.Screen name="cv" options={{ title: "CV generator" }} />
        <Stack.Screen name="education" options={{ title: "Education" }} />
        <Stack.Screen name="experience" options={{ title: "Experience" }} />
      </Stack.Protected>
      <Stack.Protected guard={member && !learner}>
        <Stack.Screen name="job-post" options={{ title: "Post a job" }} />
      </Stack.Protected>
    </Stack>
  );
}
