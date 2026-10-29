import { useLocalSearchParams } from "expo-router";
import { ProfileView } from "@/components/profile-view";

export default function UserProfile() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  return <ProfileView reference={ref} />;
}
