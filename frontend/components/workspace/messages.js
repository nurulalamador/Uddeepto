"use client";

import { useEffect, useState } from "react";
import { Plus, Send } from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "../shell";
import { Action, date, Empty, Modal, State, useResource } from "../ui";

export default function Messages() {
  const user = useUser();
  const conversations = useResource("frontend/messages");
  const [selected, setSelected] = useState(null);
  const [create, setCreate] = useState(false);
  const [text, setText] = useState("");
  const stream = useResource(
    selected ? `frontend/messages/${selected.id}` : null,
  );

  useEffect(() => {
    if (!selected) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") stream.reload();
    }, 8000);
    return () => clearInterval(timer);
  }, [selected]);

  async function sendMessage() {
    await api(`frontend/messages/${selected.id}`, {
      method: "POST",
      body: { content: text },
    });
    setText("");
    stream.reload();
    conversations.reload();
  }

  return (
    <>
      <div className="workspace-page-actions">
        <button className="button" onClick={() => setCreate(true)}>
          <Plus size={18} /> New message
        </button>
      </div>

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
                  <span className="avatar">{conversation.name?.[0]}</span>
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
                <span className="avatar">{selected.name?.[0]}</span>
                <h3>{selected.name}</h3>
              </header>
              <div className="message-stream">
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
              <div className="message-compose">
                <textarea
                  rows={2}
                  value={text}
                  maxLength={10000}
                  onChange={(event) => setText(event.target.value)}
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

      {create && (
        <Modal title="Start a conversation" onClose={() => setCreate(false)}>
          <FindPerson
            onSelect={async (person) => {
              const conversation = await api("frontend/messages", {
                method: "POST",
                body: { user_id: person.id },
              });
              setSelected({ ...conversation, name: person.name });
              setCreate(false);
              conversations.reload();
            }}
          />
        </Modal>
      )}
    </>
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
            <span className="avatar">{person.name?.[0]}</span>
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
