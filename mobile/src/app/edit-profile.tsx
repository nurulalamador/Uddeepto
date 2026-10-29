import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from "react-native";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useApi } from "@/lib/hooks";
import { prepareImage } from "@/lib/images";
import { colors } from "@/lib/config";
import { Avatar, Button, ErrorBox, Input, Loading, Notice, RemoteImage, Text } from "@/components/ui";

type Profile = {
  id: string;
  name: string;
  username: string;
  headline: string | null;
  bio: string | null;
  has_picture?: boolean;
  has_cover_image?: boolean;
  interests: { id: string }[];
  personal?: { phone?: string | null; birth_date?: string | null; gender?: string | null; current_address?: string | null; permanent_address?: string | null };
};

/** The profile details and pictures. Interests, education, experience and the CV have their own screens. */
export default function EditProfile() {
  const { user, refreshUser } = useAuth();
  const router = useRouter();
  const resource = useApi<Profile>(user ? `frontend/profile/${user.uddeepto_id || user.id}` : null);
  const [fields, setFields] = useState({ name: "", headline: "", bio: "", phone: "", address: "" });
  const [picture, setPicture] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [cover, setCover] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [removePicture, setRemovePicture] = useState(false);
  const [removeCover, setRemoveCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const profile = resource.data;

  useEffect(() => {
    if (profile)
      setFields({ name: profile.name, headline: profile.headline || "", bio: profile.bio || "", phone: profile.personal?.phone || "", address: profile.personal?.current_address || "" });
  }, [profile]);

  async function choose(set: (value: { uri: string; name: string; type: string }) => void, aspect: [number, number]) {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect, quality: 0.9 });
    const asset = result.assets?.[0];
    if (!result.canceled && asset) set(await prepareImage(asset));
  }

  async function save() {
    if (!profile) return;
    if (fields.name.trim().length < 2) return setError("Enter your name.");
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("name", fields.name.trim());
      form.append("username", profile.username);
      form.append("bio", fields.bio);
      form.append("headline", fields.headline.trim());
      form.append("phone", fields.phone.trim());
      form.append("current_address", fields.address.trim());
      // What this form does not show is sent back unchanged.
      form.append("birth_date", profile.personal?.birth_date || "");
      form.append("gender", profile.personal?.gender || "");
      form.append("permanent_address", profile.personal?.permanent_address || "");
      if (picture) form.append("picture", picture as any);
      else if (removePicture) form.append("remove_picture", "true");
      if (cover) form.append("cover_image", cover as any);
      else if (removeCover) form.append("remove_cover_image", "true");
      form.append("interest_ids", JSON.stringify(profile.interests.map((interest) => interest.id)));
      await api("frontend/profile", { method: "PATCH", form });
      await refreshUser();
      router.back();
    } catch (problem: any) {
      setError(problem.message);
      setBusy(false);
    }
  }

  if (resource.loading) return <Loading />;
  if (!profile) return <ErrorBox message={resource.error || "Could not load your profile."} onRetry={resource.reload} />;
  const set = (key: keyof typeof fields) => (value: string) => setFields((current) => ({ ...current, [key]: value }));

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={{ gap: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text }}>Cover picture</Text>
          <Pressable onPress={() => choose(setCover, [3, 1])} style={{ height: 110, borderRadius: 16, overflow: "hidden", backgroundColor: colors.greenSoft, alignItems: "center", justifyContent: "center" }}>
            {cover ? <Image source={{ uri: cover.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : profile.has_cover_image && !removeCover ? <RemoteImage path={`frontend/profile/${profile.id}/cover`} style={StyleSheet.absoluteFill} /> : null}
            <Text style={{ color: cover || (profile.has_cover_image && !removeCover) ? "#fff" : colors.green, fontWeight: "800", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4 }}>{cover ? "Cover chosen · tap to change" : profile.has_cover_image && !removeCover ? "Tap to change the cover" : "Tap to add a cover"}</Text>
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <Avatar id={profile.id} name={profile.name} hasPicture={profile.has_picture && !removePicture && !picture} size={64} />
            <View style={{ flex: 1, gap: 8 }}>
              <Button label={picture ? "Picture chosen · change" : "Change profile picture"} icon="camera-outline" kind="soft" onPress={() => choose(setPicture, [1, 1])} />
              {(profile.has_picture || picture) && !removePicture ? <Button label="Remove picture" kind="secondary" onPress={() => { setPicture(null); setRemovePicture(true); }} /> : null}
            </View>
          </View>
          {profile.has_cover_image && !removeCover ? <Button label="Remove cover" kind="secondary" onPress={() => { setCover(null); setRemoveCover(true); }} /> : null}
        </View>
        <Input label="Full name" value={fields.name} onChangeText={set("name")} maxLength={150} />
        <Input label="Headline" value={fields.headline} onChangeText={set("headline")} placeholder="e.g. Junior web developer" maxLength={200} />
        <Input label="About you" value={fields.bio} onChangeText={set("bio")} multiline maxLength={3000} style={{ minHeight: 120 }} />
        <Input label="Phone" value={fields.phone} onChangeText={set("phone")} keyboardType="phone-pad" maxLength={30} />
        <Input label="Current address" value={fields.address} onChangeText={set("address")} maxLength={500} />
        {error ? <Notice>{error}</Notice> : null}
        <Button label="Save profile" icon="checkmark" onPress={save} busy={busy} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ page: { padding: 16, gap: 14, paddingBottom: 40 } });
