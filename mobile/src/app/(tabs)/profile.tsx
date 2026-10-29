import { Alert, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { Button, Card, Text, type IconName } from "@/components/ui";
import { ProfileView } from "@/components/profile-view";
import { colors } from "@/lib/config";

export default function ProfileTab() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  if (!user) return null;
  const learner = user.role === "learner";

  const confirmSignOut = () => Alert.alert("Sign out?", "You will need to sign in again.", [{ text: "Cancel", style: "cancel" }, { text: "Sign out", style: "destructive", onPress: signOut }]);
  const links: { label: string; icon: IconName; to: string }[] = learner
    ? [
        { label: "Education", icon: "school-outline", to: "/education" },
        { label: "Experience", icon: "briefcase-outline", to: "/experience" },
        { label: "Interests", icon: "pricetags-outline", to: "/interests" },
        { label: "CV generator", icon: "document-text-outline", to: "/cv" },
      ]
    : [];

  return (
    <ProfileView reference={user.uddeepto_id || user.id}>
      <View style={styles.actions}>
        <Button label="Edit profile" icon="create-outline" onPress={() => router.push("/edit-profile")} style={{ flex: 1 }} />
        <Button label="Settings" icon="settings-outline" kind="secondary" onPress={() => router.push("/settings")} style={{ flex: 1 }} />
      </View>
      {links.length ? (
        <Card>
          <Text style={styles.heading}>Manage</Text>
          <View style={styles.grid}>
            {links.map((link) => (
              <Button key={link.to} label={link.label} icon={link.icon} kind="soft" onPress={() => router.push(link.to as any)} style={{ flexBasis: "47%", flexGrow: 1 }} />
            ))}
          </View>
        </Card>
      ) : null}
      <Button label="Sign out" icon="log-out-outline" kind="secondary" onPress={confirmSignOut} />
    </ProfileView>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 10 },
  heading: { fontSize: 16, fontWeight: "800", color: colors.text },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
