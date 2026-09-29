"use client";

import { useState } from "react";
import { ArrowUpRight, Hash, Plus, Send, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "../shell";
import {
  Action,
  Badge,
  date,
  Dropdown,
  Empty,
  Heading,
  Modal,
  Pager,
  SearchBox,
  State,
  useResource,
} from "../ui";

export default function Communities() {
  const user = useUser();
  const isLearner = user.role === "learner";
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const [create, setCreate] = useState(false);
  const resource = useResource(
    `frontend/catalog/communities?q=${encodeURIComponent(query)}&offset=${page * 12}&limit=12`,
  );

  return (
    <>
      {!isLearner && (
        <Heading
          eyebrow="FIND YOUR PEOPLE"
          title="Better, together."
          description="A place to exchange ideas, ask questions and grow with others."
        />
      )}

      <div className="toolbar community-page-toolbar">
        <div className="community-page-search">
          <SearchBox
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(0);
            }}
            placeholder="Find a community…"
          />
        </div>
        <button className="button" onClick={() => setCreate(true)}>
          <Plus size={18} /> Create community
        </button>
      </div>

      <State resource={resource}>
        {resource.data?.length ? (
          <div className="grid three">
            {resource.data.map((community, index) => (
              <article className="card community-card" key={community.id}>
                <div className={`community-icon shade-${index % 4}`}>
                  <Users size={34} />
                </div>
                <Badge>{community.category_name}</Badge>
                <h2>{community.name}</h2>
                <p className="clamp">{community.description}</p>
                <footer>
                  <span>{community.member_count} members</span>
                  <button
                    className="text-link"
                    onClick={() => setSelected(community)}
                  >
                    Visit <ArrowUpRight size={18} />
                  </button>
                </footer>
              </article>
            ))}
          </div>
        ) : (
          <Empty title="Find your first community" />
        )}
      </State>

      <Pager
        page={page}
        setPage={setPage}
        hasMore={resource.data?.length === 12}
      />

      {create && (
        <Modal title="Start a community" onClose={() => setCreate(false)}>
          <CommunityForm
            onDone={() => {
              setCreate(false);
              resource.reload();
            }}
          />
        </Modal>
      )}
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <CommunityDetail item={selected} />
        </Modal>
      )}
    </>
  );
}

function CommunityForm({ onDone }) {
  const categories = useResource("users/interests");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!category) {
      setError("Choose an interest for this community.");
      return;
    }
    setBusy(true);
    try {
      const body = Object.fromEntries(new FormData(event.currentTarget));
      body.requires_approval = body.requires_approval === "true";
      body.is_private = body.is_private === "true";
      await api("frontend/communities", { method: "POST", body });
      onDone();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Name
        <input name="name" required maxLength={150} />
      </label>
      <label>
        Unique slug
        <input
          name="slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="creative-coders"
        />
      </label>
      <label>
        Description
        <textarea name="description" required rows={4} />
      </label>
      <label>
        Interest
        <Dropdown
          ariaLabel="Choose a community interest"
          name="category_id"
          required
          value={category}
          onChange={setCategory}
          placeholder="Choose an interest"
          options={(categories.data || []).map((item) => ({
            value: String(item.id),
            label: item.name,
            iconName: item.icon,
          }))}
          hasIcon
          disabled={!categories.data?.length}
        />
      </label>
      <label>
        Joining
        <select name="requires_approval">
          <option value="false">Anyone can join</option>
          <option value="true">Approve new members</option>
        </select>
      </label>
      <label>
        Visibility
        <select name="is_private">
          <option value="false">Public community</option>
          <option value="true">Private community</option>
        </select>
      </label>
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      <button className="button" disabled={busy || !categories.data?.length}>
        {busy ? "Creating…" : "Create community"}
      </button>
    </form>
  );
}

function CommunityDetail({ item }) {
  const resource = useResource(`frontend/communities/${item.id}`);
  const [channel, setChannel] = useState("");
  const [text, setText] = useState("");
  const messages = useResource(
    channel ? `frontend/communities/${item.id}/chats/${channel}` : null,
  );

  return (
    <State resource={resource}>
      {resource.data && (
        <div className="stack">
          <p>{item.description}</p>
          <Action
            disabled={["approved", "pending", "blocked"].includes(
              resource.data.membership,
            )}
            onClick={async () => {
              await api(`communities/${item.id}/join`, { method: "POST" });
              resource.reload();
            }}
          >
            {resource.data.membership === "approved"
              ? "You’re a member"
              : resource.data.membership === "pending"
                ? "Approval pending"
                : resource.data.membership === "blocked"
                  ? "Membership blocked"
                  : "Join community"}
          </Action>

          {resource.data.can_manage && (
            <>
              <h3>Membership requests</h3>
              {resource.data.pending?.map((member) => (
                <div className="row spread" key={member.member_id}>
                  <span>{member.name}</span>
                  <Action
                    className="text-link"
                    onClick={async () => {
                      await api(
                        `frontend/communities/${item.id}/members/${member.member_id}`,
                        { method: "PATCH", body: { status: "approved" } },
                      );
                      resource.reload();
                    }}
                  >
                    Approve
                  </Action>
                  <Action
                    className="text-link"
                    onClick={async () => {
                      await api(
                        `frontend/communities/${item.id}/members/${member.member_id}`,
                        { method: "PATCH", body: { status: "rejected" } },
                      );
                      resource.reload();
                    }}
                  >
                    Reject
                  </Action>
                </div>
              ))}
              <Action
                className="button secondary"
                onClick={async () => {
                  const name = prompt("Channel name");
                  if (name?.trim()) {
                    await api(`frontend/communities/${item.id}/chats`, {
                      method: "POST",
                      body: { name },
                    });
                    resource.reload();
                  }
                }}
              >
                Create channel
              </Action>
            </>
          )}

          {resource.data.membership === "approved" && (
            <>
              <label>
                Channel
                <select
                  value={channel}
                  onChange={(event) => setChannel(event.target.value)}
                >
                  <option value="">Choose a channel</option>
                  {resource.data.chats?.map((chat) => (
                    <option value={chat.id} key={chat.id}>
                      # {chat.name}
                    </option>
                  ))}
                </select>
              </label>
              {channel && (
                <>
                  <div className="chat-stream">
                    <State resource={messages}>
                      {messages.data?.map((message) => (
                        <div className="chat-message" key={message.id}>
                          <strong>{message.sender_name}</strong>
                          <p>{message.content}</p>
                          <small>{date(message.created_at)}</small>
                        </div>
                      ))}
                    </State>
                  </div>
                  <div className="comment-input">
                    <input
                      aria-label="Message channel"
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      placeholder="Message the community…"
                    />
                    <Action
                      className="icon-button"
                      aria-label="Send message"
                      disabled={!text.trim()}
                      onClick={async () => {
                        await api(
                          `frontend/communities/${item.id}/chats/${channel}`,
                          { method: "POST", body: { content: text } },
                        );
                        setText("");
                        messages.reload();
                      }}
                    >
                      <Send size={20} />
                    </Action>
                  </div>
                  <button className="text-link" onClick={messages.reload}>
                    Refresh messages
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </State>
  );
}
