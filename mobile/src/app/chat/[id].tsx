import { Stack, useLocalSearchParams } from "expo-router";
import { useApi } from "@/lib/hooks";
import { ChatView } from "@/components/chat-view";

type Conversation = { id: string; name: string };

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversations = useApi<Conversation[]>("frontend/messages");
  const name = conversations.data?.find((conversation) => conversation.id === id)?.name;
  return (
    <>
      <Stack.Screen options={{ title: name || "Chat" }} />
      <ChatView path={`frontend/messages/${id}`} group={false} liveEvent="message:new" conversationId={id} accept={(payload) => (payload?.conversation_id === id ? { ...payload.message, sender_name: payload.sender_name, sender_has_picture: payload.sender_has_picture } : null)} />
    </>
  );
}
