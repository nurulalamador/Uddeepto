"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Crown, Hash, Lock, Plus, Shield, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "../shell";
import { CategoryPicker, Empty, Heading, Modal, Pager, SearchBox, State, useResource } from "../ui";
import { CategoryChips } from "./courses";

const PAGE_SIZE = 12;

const roleMeta = {
  owner: { label: "Owner", Icon: Crown },
  moderator: { label: "Moderator", Icon: Shield },
};

function CommunityTile({ item, index, mine }) {
  const role = roleMeta[item.role];
  const count = Number(item.member_count);
  return (
    <Link className="community-tile" href={`/communities/${item.id}`}>
      <div className={`community-banner shade-${index % 4}`}>
        <Users size={30} strokeWidth={1.6} />
        <span className="community-banner-tags">
          {item.is_private && (
            <span className="community-tag">
              <Lock size={12} /> Private
            </span>
          )}
          {mine && role && (
            <span className="community-tag">
              <role.Icon size={12} /> {role.label}
            </span>
          )}
        </span>
      </div>
      <div className="community-tile-body">
        <CategoryChips categories={item.category_details} limit={3} />
        <h3>{item.name}</h3>
        <p className="clamp">{item.description}</p>
        <footer>
          <span className="community-meta">
            <Users size={15} /> {count} member{count === 1 ? "" : "s"}
            {mine && (
              <>
                <Hash size={15} /> {Number(item.channel_count)} channel{Number(item.channel_count) === 1 ? "" : "s"}
              </>
            )}
          </span>
          {!mine && item.membership === "pending" ? (
            <span className="joined-tag">Requested</span>
          ) : !mine && item.membership === "blocked" ? (
            <span className="joined-tag muted">Unavailable</span>
          ) : (
            <span className="contest-card-link">
              {mine ? "Open" : item.requires_approval ? "View" : "View & join"} <ArrowUpRight size={16} />
            </span>
          )}
        </footer>
      </div>
    </Link>
  );
}

export default function Communities() {
  const user = useUser();
  const isLearner = user.role === "learner";
  const [tab, setTab] = useState("mine");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [create, setCreate] = useState(false);
  const mine = tab === "mine";
  const resource = useResource(
    mine
      ? `frontend/communities/mine?q=${encodeURIComponent(query)}&offset=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`
      : `frontend/catalog/communities?tab=explore&q=${encodeURIComponent(query)}&offset=${page * PAGE_SIZE}&limit=${PAGE_SIZE}`,
  );

  return (
    <div className="courses-page">
      {!isLearner && (
        <Heading
          eyebrow="FIND YOUR PEOPLE"
          title="Better, together."
          description="A place to exchange ideas, ask questions and grow with others."
        />
      )}

      <div className="courses-sticky">
        <div className="tabs">
          {[
            ["mine", "My communities"],
            ["explore", "Explore communities"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => {
                setTab(value);
                setPage(0);
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="toolbar community-page-toolbar">
          <div className="community-page-search">
            <SearchBox
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(0);
              }}
              placeholder={mine ? "Search your communities…" : "Find a community…"}
            />
          </div>
          <button className="button" onClick={() => setCreate(true)}>
            <Plus size={18} /> Create community
          </button>
        </div>
      </div>

      <State resource={resource}>
        {resource.data?.length ? (
          <div className="community-grid">
            {resource.data.map((community, index) => (
              <CommunityTile item={community} index={index} mine={mine} key={community.id} />
            ))}
          </div>
        ) : mine ? (
          <div className="empty">
            <Users size={32} />
            <h3>{query ? "No communities match your search" : "You haven’t joined any community yet"}</h3>
            <p>Explore communities to find people who share your interests.</p>
            {!query && (
              <button className="button secondary" onClick={() => setTab("explore")}>
                Explore communities
              </button>
            )}
          </div>
        ) : (
          <Empty title="Nothing new to explore" text="You’ve joined every community that matches. Try creating your own!" />
        )}
      </State>

      <Pager page={page} setPage={setPage} hasMore={resource.data?.length === PAGE_SIZE} />

      {create && (
        <Modal title="Start a community" onClose={() => setCreate(false)}>
          <CommunityForm />
        </Modal>
      )}
    </div>
  );
}

const slugify = (value) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

function CommunityForm() {
  const router = useRouter();
  const categories = useResource("users/interests");
  const [selected, setSelected] = useState([]);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!selected.length) {
      setError("Choose at least one interest for this community.");
      return;
    }
    setBusy(true);
    try {
      const body = Object.fromEntries(new FormData(event.currentTarget));
      body.requires_approval = body.requires_approval === "true";
      body.is_private = body.is_private === "true";
      body.category_ids = selected;
      const created = await api("frontend/communities", { method: "POST", body });
      router.push(`/communities/${created.id}`);
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Name
        <input
          name="name"
          required
          maxLength={150}
          onChange={(event) => {
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
        />
      </label>
      <label>
        Unique slug
        <input
          name="slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          placeholder="creative-coders"
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
        />
      </label>
      <label>
        Description
        <textarea name="description" required rows={4} />
      </label>
      <CategoryPicker
        categories={categories.data || []}
        value={selected}
        onChange={setSelected}
        legend="Interests"
      />
      <div className="grid two">
        <label>
          Joining
          <select name="requires_approval" defaultValue="false">
            <option value="false">Anyone can join</option>
            <option value="true">Approve new members</option>
          </select>
        </label>
        <label>
          Visibility
          <select name="is_private" defaultValue="false">
            <option value="false">Public community</option>
            <option value="true">Private community</option>
          </select>
        </label>
      </div>
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
