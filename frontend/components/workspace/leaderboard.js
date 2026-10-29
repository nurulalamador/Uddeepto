"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Crown, Medal } from "lucide-react";
import { useUser } from "../shell";
import { Dropdown, Empty, State, UserAvatar, useResource } from "../ui";

const MEDAL = { 1: "gold", 2: "silver", 3: "bronze" };

function Points({ value }) {
  return (
    <span className={`lb-points${value < 0 ? " negative" : ""}`}>
      <b>{value}</b> pts
    </span>
  );
}

function Row({ entry, isMe }) {
  return (
    <li>
      <Link className={`lb-row${isMe ? " me" : ""}`} href={`/profile/${entry.uddeepto_id}`}>
        <span className={`lb-rank ${MEDAL[entry.rank] || ""}`}>{entry.rank <= 3 ? <Medal size={16} /> : null}#{entry.rank}</span>
        <UserAvatar id={entry.id} name={entry.name} hasPicture={entry.has_picture} size={40} />
        <span className="lb-name">
          <strong>{entry.name}{isMe ? " (you)" : ""}</strong>
          <small>@{entry.username}</small>
        </span>
        <Points value={entry.total} />
      </Link>
    </li>
  );
}

/** The top three learners and a button to the complete leaderboard (used on the dashboard). */
export function LeaderboardPreview() {
  const user = useUser();
  const resource = useResource("frontend/leaderboard?limit=3");
  const items = resource.data?.items || [];
  return (
    <section className="ld-card lb-preview">
      <header>
        <h2>
          <Medal size={18} /> Leaderboard
        </h2>
      </header>
      {items.length ? (
        <ul className="lb-list">
          {items.map((entry) => (
            <Row key={entry.id} entry={entry} isMe={entry.id === user.id} />
          ))}
        </ul>
      ) : (
        <p className="ld-muted">{resource.loading ? "Loading…" : "Finish courses and contests to appear here."}</p>
      )}
      <Link className="button lb-more" href="/leaderboard">
        Complete leaderboard <ArrowRight size={16} />
      </Link>
    </section>
  );
}

export default function Leaderboard() {
  const user = useUser();
  const [category, setCategory] = useState("");
  const categories = useResource("users/interests");
  const resource = useResource(`frontend/leaderboard?limit=100&category=${category}`);
  const data = resource.data;
  const podium = (data?.items || []).filter((entry) => entry.rank <= 3).slice(0, 3);
  const rest = (data?.items || []).filter((entry) => !podium.includes(entry));

  return (
    <div className="lb">
      <div className="page-heading lb-heading">
        <p>Points are calculated from contest and course performance.</p>
        <Dropdown
          ariaLabel="Filter by interest"
          value={category}
          onChange={setCategory}
          options={[{ value: "", label: "All interests" }, ...(categories.data || []).map((item) => ({ value: String(item.id), label: item.name, iconName: item.icon }))]}
          hasIcon
        />
      </div>

      {data?.me && (
        <div className="lb-me">
          <Crown size={18} />
          <span>
            Your position: <b>#{data.me.rank}</b> of {data.total}
          </span>
          <Points value={data.me.total} />
        </div>
      )}

      <State resource={resource}>
        {data && data.items.length === 0 && <Empty title="No learners here yet" text="Nobody with this interest has points yet." />}
        {podium.length > 0 && (
          <div className="lb-podium">
            {podium.map((entry) => (
              <Link key={entry.id} className={`lb-step ${MEDAL[entry.rank]}`} href={`/profile/${entry.uddeepto_id}`}>
                <span className="lb-step-medal">
                  <Medal size={20} />
                </span>
                <UserAvatar id={entry.id} name={entry.name} hasPicture={entry.has_picture} size={64} />
                <strong>{entry.name}{entry.id === user.id ? " (you)" : ""}</strong>
                <Points value={entry.total} />
                <span className="lb-step-rank">#{entry.rank}</span>
              </Link>
            ))}
          </div>
        )}
        {rest.length > 0 && (
          <ul className="lb-list">
            {rest.map((entry) => (
              <Row key={entry.id} entry={entry} isMe={entry.id === user.id} />
            ))}
          </ul>
        )}
      </State>
    </div>
  );
}
