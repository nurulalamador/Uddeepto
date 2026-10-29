import { Stack, useLocalSearchParams } from "expo-router";
import { ChatView } from "@/components/chat-view";

export default function CommunityChat() {
  const { id, chatId, name } = useLocalSearchParams<{ id: string; chatId: string; name?: string }>();
  return (
    <>
      <Stack.Screen options={{ title: name ? `# ${name}` : "Channel" }} />
      <ChatView path={`frontend/communities/${id}/chats/${chatId}`} group liveEvent="community:message" accept={(payload) => (payload?.community_id === id && payload?.chat_id === chatId ? payload.message : null)} />
    </>
  );
}
