"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Search } from "lucide-react";
import { Empty, Pager, State, useResource } from "../ui";
import { ResultRow, typeMeta } from "../global-search";

const PAGE_SIZE = 12;

export default function SearchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const q = (params.get("q") || "").trim();
  const tab = params.get("tab") || "all";
  const [draft, setDraft] = useState(q);
  const [page, setPage] = useState(0);
  const type = tab === "all" ? "" : tab;
  const ready = q.length >= 2;
  const resource = useResource(
    ready ? `frontend/search?q=${encodeURIComponent(q)}${type ? `&type=${type}&limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}` : "&limit=5"}` : null,
  );
  const data = resource.data;

  useEffect(() => setDraft(q), [q]);
  useEffect(() => setPage(0), [q, tab]);

  const go = (nextQ, nextTab) => router.replace(`/search?q=${encodeURIComponent(nextQ)}${nextTab && nextTab !== "all" ? `&tab=${nextTab}` : ""}`);
  const types = data?.types || [];
  const total = data ? Object.values(data.counts).reduce((sum, count) => sum + count, 0) : 0;

  return (
    <div className="courses-page search-page">
      <form
        className="search-hero"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim().length >= 2) go(draft.trim(), tab);
        }}
      >
        <Search size={22} aria-hidden="true" />
        <input aria-label="Search Uddeepto" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Search people, courses, contests, webinars, jobs…" autoFocus={!q} />
        <button className="button" disabled={draft.trim().length < 2}>
          Search
        </button>
      </form>

      {!ready ? (
        <Empty title="Search everything on Uddeepto" text="Type at least 2 characters to find people, courses, contests, webinars, jobs and communities." />
      ) : (
        <>
          <div className="courses-sticky">
            <div className="tabs" role="tablist">
              {[["all", "All", total], ...types.map((key) => [key, data.labels[key], data.counts[key]])].map(([key, label, count]) => (
                <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? "active" : ""} onClick={() => go(q, key)}>
                  {label} {data && <span className="search-count">{count}</span>}
                </button>
              ))}
            </div>
          </div>

          <State resource={resource}>
            {data && tab === "all" && (
              total ? (
                <div className="search-groups">
                  {types
                    .filter((key) => data.results[key]?.length)
                    .map((key) => {
                      const { label, Icon } = typeMeta[key];
                      return (
                        <section className="search-group" key={key} aria-label={label}>
                          <header>
                            <h2>
                              <Icon size={18} /> {label}
                            </h2>
                            {data.counts[key] > data.results[key].length && (
                              <button type="button" className="text-link" onClick={() => go(q, key)}>
                                See all {data.counts[key]} <ArrowRight size={14} />
                              </button>
                            )}
                          </header>
                          <div className="search-list">
                            {data.results[key].map((item) => (
                              <ResultRow key={`${item.type}-${item.id}`} item={item} />
                            ))}
                          </div>
                        </section>
                      );
                    })}
                </div>
              ) : (
                <Empty title={`No results for “${q}”`} text="Check the spelling or try a shorter, more general word." />
              )
            )}
            {data && tab !== "all" && (
              data.results[tab]?.length ? (
                <>
                  <div className="search-list">
                    {data.results[tab].map((item) => (
                      <ResultRow key={`${item.type}-${item.id}`} item={item} />
                    ))}
                  </div>
                  <Pager page={page} setPage={setPage} hasMore={(page + 1) * PAGE_SIZE < data.counts[tab]} />
                </>
              ) : (
                <Empty title={`No ${data.labels[tab]?.toLowerCase() || "results"} found`} text={`Nothing in ${data.labels[tab] || "this category"} matches “${q}”.`} />
              )
            )}
          </State>
        </>
      )}
    </div>
  );
}
