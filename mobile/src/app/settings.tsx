import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import Constants from "expo-constants";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { colors } from "@/lib/config";
import { Button, Card, Input, Muted, Notice, Text } from "@/components/ui";

export default function Settings() {
  const { user, signOut } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function change() {
    if (next.length < 8) return setError("Use at least 8 characters.");
    if (next !== again) return setError("The two new passwords do not match.");
    setBusy(true);
    setError("");
    try {
      await api("frontend/account/password", { method: "POST", body: { currentPassword: current, newPassword: next } });
      // Every session was ended on the server, this one too: sign in again with the new password.
      Alert.alert("Password changed", "You have been signed out everywhere. Sign in with your new password.");
      await signOut();
    } catch (problem: any) {
      setError(problem.message);
      setBusy(false);
    }
  }

  function confirmDelete() {
    if (!deletePassword) return setDeleteError("Enter your password to confirm.");
    Alert.alert("Delete your account?", "This is permanent. Your profile, CV, interests and notifications are erased.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete forever",
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          setDeleteError("");
          try {
            await api("frontend/account", { method: "DELETE", body: { password: deletePassword } });
            await signOut();
          } catch (problem: any) {
            setDeleteError(problem.message);
            setDeleting(false);
          }
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Muted>
          Signed in as {user?.name} ({user?.email || `@${user?.username}`})
        </Muted>
        <Card>
          <Text style={styles.heading}>Change password</Text>
          <Muted>Use at least 8 characters. You will be signed out on every device.</Muted>
          <Input label="Current password" value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" autoComplete="current-password" />
          <Input label="New password" value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
          <Input label="Confirm new password" value={again} onChangeText={setAgain} secureTextEntry autoCapitalize="none" autoComplete="new-password" />
          {error ? <Notice>{error}</Notice> : null}
          <Button label="Change password" onPress={change} busy={busy} disabled={!current || !next || !again} />
        </Card>
        <Card>
          <Text style={styles.heading}>Delete account</Text>
          <Muted>Deleting an account is permanent. Enter your password to confirm.</Muted>
          <Input label="Password" value={deletePassword} onChangeText={setDeletePassword} secureTextEntry autoCapitalize="none" />
          {deleteError ? <Notice>{deleteError}</Notice> : null}
          <Button label="Delete my account" icon="trash-outline" kind="danger" onPress={confirmDelete} busy={deleting} />
        </Card>
        <Muted style={{ textAlign: "center" }}>Uddeepto app {Constants.expoConfig?.version || ""}</Muted>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 16, gap: 14, paddingBottom: 40 },
  heading: { fontSize: 16, fontWeight: "800", color: colors.text },
});
