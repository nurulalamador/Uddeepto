"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Send } from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "../shell";
import { useRealtime, useSocketEvent } from "../realtime";
import { Action, date, Empty, Modal, State, UserAvatar, useResource } from "../ui";

export default function Messages() {
  const user = useUser();
  const conversations = useResource("frontend/messages");
  const router = useRouter();
  const params = useSearchParams();
  const startWith = params.get("with");
  const [selected, setSelected] = useState(null);
  const [create, setCreate] = useState(false);
  const [text, setText] = useState("");
  const stream = useResource(
    selected ? `frontend/messages/${selected.id}` : null,
  );
  const { socket, connected } = useRealtime();
  const [typing, setTyping] = useState(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);
  const streamBox = useRef(null);
  const wasConnected = useRef(connected);

  // /messages?with=<userId> opens (or creates) the conversation with that person.
  useEffect(() => {
    if (!startWith) return;
    let live = true;
    api("frontend/messages", { method: "POST", body: { user_id: startWith } })
      .then(async (conversation) => {
        const list = await api("frontend/messages");
        if (!live) return;
        setSelected(list.find((item) => item.id === conversation.id) || null);
        conversations.reload();
      })
      .catch(() => {})
      .finally(() => live && router.replace("/messages"));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startWith]);

  // Messages arrive over the socket; polling is only the fallback while it is down.
  useEffect(() => {
    if (!selected || connected) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") stream.reload();
    }, 8000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, connected]);

  // After a dropped connection, fetch whatever was missed.
  useEffect(() => {
    if (connected && !wasConnected.current) {
      conversations.reload();
      if (selected) stream.reload();
    }
    wasConnected.current = connected;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const addToStream = (message) =>
    stream.setData((list) => (list?.some((item) => item.id === message.id) ? list : [...(list || []), message]));
  // Newest conversation first, with its last message shown in the list.
  const bumpConversation = (id, message) =>
    conversations.setData((list) => {
      const found = list?.find((item) => item.id === id);
      if (!found) return list;
      return [{ ...found, last_message: message.content, updated_at: message.sent_at }, ...list.filter((item) => item.id !== id)];
    });

  useSocketEvent("message:new", (event) => {
    if (!conversations.data?.some((item) => item.id === event.conversation_id)) conversations.reload();
    else bumpConversation(event.conversation_id, event.message);
    if (selected && event.conversation_id === selected.id) addToStream(event.message);
    if (event.message.sender_id !== user.id) setTyping(null);
  });
  useSocketEvent("typing", (event) => {
    if (event.scope !== "dm") return;
    setTyping({ conversation_id: event.conversation_id, name: event.name });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(null), 3500);
  });
  useEffect(() => () => clearTimeout(typingTimer.current), []);

  // Keep the newest message in view.
  useEffect(() => {
    const element = streamBox.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [stream.data?.length, selected?.id]);

  function announceTyping() {
    const now = Date.now();
    if (!socket || !connected || !selected || now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    socket.emit("typing", { scope: "dm", conversation_id: selected.id });
  }

  async function sendMessage() {
    const message = await api(`frontend/messages/${selected.id}`, {
      method: "POST",
      body: { content: text },
    });
    setText("");
    addToStream(message);
    bumpConversation(selected.id, message);
  }

  return (
    <div className="messages-page">
      <div className="messenger">
        <aside>
          <State resource={conversations}>
            {conversations.data?.length ? (
              conversations.data.map((conversation) => (
                <button
                  key={conversation.id}
                  className={`conversation ${selected?.id === conversation.id ? "selected" : ""}`}
                  onClick={() => setSelected(conversation)}
                >
                  <UserAvatar id={conversation.other_user_id} name={conversation.name} hasPicture={conversation.other_has_picture} />
                  <span>
                    <strong>{conversation.name}</strong>
                    <small>
                      {conversation.last_message || "Start the conversation"}
                    </small>
                  </span>
                </button>
              ))
            ) : (
              <Empty
                title="No conversations yet"
                text="Find someone and say hello."
              />
            )}
          </State>
        </aside>

        <section>
          {selected ? (
            <>
              <header>
                <UserAvatar id={selected.other_user_id} name={selected.name} hasPicture={selected.other_has_picture} />
                <h3>{selected.name}</h3>
              </header>
              <div className="message-stream" ref={streamBox}>
                <State resource={stream}>
                  {stream.data?.map((message) => (
                    <article
                      className={`bubble ${message.sender_id === user.id ? "mine" : ""}`}
                      key={message.id}
                    >
                      <p>{message.content}</p>
                      <small>{date(message.sent_at)}</small>
                    </article>
                  ))}
                </State>
              </div>
              <p className="typing-indicator" aria-live="polite">
                {typing?.conversation_id === selected.id ? `${typing.name} is typing…` : ""}
              </p>
              <div className="message-compose">
                <textarea
                  rows={2}
                  value={text}
                  maxLength={10000}
                  onChange={(event) => {
                    setText(event.target.value);
                    if (event.target.value.trim()) announceTyping();
                  }}
                  placeholder={`Message ${selected.name}…`}
                  aria-label="Message"
                />
                <Action disabled={!text.trim()} onClick={sendMessage}>
                  <Send size={19} /> Send
                </Action>
              </div>
            </>
          ) : (
            <Empty
              title="Your conversations live here"
              text="Choose a conversation or start a new one."
            />
          )}
        </section>
      </div>

      <button type="button" className="fab" onClick={() => setCreate(true)} aria-label="New message">
        <Plus size={22} />
        <span>New message</span>
      </button>

      {create && (
        <Modal title="Start a conversation" onClose={() => setCreate(false)}>
          <FindPerson
            onSelect={async (person) => {
              const conversation = await api("frontend/messages", {
                method: "POST",
                body: { user_id: person.id },
              });
              setSelected({ ...conversation, name: person.name, other_user_id: person.id, other_has_picture: person.has_picture });
              setCreate(false);
              conversations.reload();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

export function FindPerson({ onSelect }) {
  const [query, setQuery] = useState("");
  const resource = useResource(
    query.length >= 2 ? `frontend/people?q=${encodeURIComponent(query)}` : null,
  );

  return (
    <div className="stack">
      <label>
        Search by name or username
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type at least two characters…"
        />
      </label>
      <State resource={resource}>
        {resource.data?.map((person) => (
          <div className="list-row" key={person.id}>
            <UserAvatar id={person.id} name={person.name} hasPicture={person.has_picture} />
            <div>
              <strong>{person.name}</strong>
              <p>@{person.username}</p>
            </div>
            <Action className="text-link" onClick={() => onSelect(person)}>
              Select
            </Action>
          </div>
        ))}
      </State>
    </div>
  );
}
