"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Ellipsis,
  Flag,
  Heart,
  ImagePlus,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useUser } from "../shell";
import {
  Action,
  date,
  Dropdown,
  Empty,
  Heading,
  Modal,
  SearchBox,
  State,
  useResource,
} from "../ui";

const PAGE_SIZE = 12;

function feedUrl(query, category, offset = 0) {
  return (
    "frontend/showcase?q=" +
    encodeURIComponent(query) +
    "&category=" +
    encodeURIComponent(category) +
    "&offset=" +
    offset +
    "&limit=" +
    PAGE_SIZE
  );
}

export default function Showcase() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);
  const [create, setCreate] = useState(false);
  const sentinelRef = useRef(null);
  const loadingMoreRef = useRef(false);
  const activeQueryRef = useRef("");
  const loadMoreRef = useRef(null);
  const cats = useResource("users/interests");

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  const queryKey = JSON.stringify([query, category]);

  useEffect(() => {
    let active = true;
    const key = queryKey;
    activeQueryRef.current = key;
    loadingMoreRef.current = false;
    setPosts([]);
    setError("");
    setLoading(true);
    setLoadingMore(false);
    setHasMore(true);

    api(feedUrl(query, category))
      .then((items) => {
        if (!active) return;
        setPosts(items);
        setHasMore(items.length === PAGE_SIZE);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query, category, retryVersion, queryKey]);

  const refreshFeed = useCallback(async () => {
    const key = JSON.stringify([query, category]);
    setLoading(true);
    setError("");
    try {
      const items = await api(feedUrl(query, category));
      if (activeQueryRef.current !== key) return;
      setPosts(items);
      setHasMore(items.length === PAGE_SIZE);
    } catch (requestError) {
      if (activeQueryRef.current === key) setError(requestError.message);
    } finally {
      if (activeQueryRef.current === key) setLoading(false);
    }
  }, [query, category]);

  const loadMore = useCallback(
    async (retry = false) => {
      if (
        loading ||
        loadingMoreRef.current ||
        !hasMore ||
        posts.length === 0 ||
        (error && !retry)
      ) {
        return;
      }

      const key = queryKey;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      setError("");

      try {
        const items = await api(feedUrl(query, category, posts.length));
        if (activeQueryRef.current !== key) return;
        setPosts((current) => {
          const known = new Set(current.map((post) => post.id));
          return current.concat(items.filter((post) => !known.has(post.id)));
        });
        setHasMore(items.length === PAGE_SIZE);
      } catch (requestError) {
        if (activeQueryRef.current === key) setError(requestError.message);
      } finally {
        if (activeQueryRef.current === key) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        }
      }
    },
    [loading, hasMore, posts.length, query, category, queryKey, error],
  );

  loadMoreRef.current = loadMore;

  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || loading || !hasMore || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMoreRef.current?.();
        }
      },
      { rootMargin: "360px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [loading, hasMore, posts.length]);

  function retryInitialLoad() {
    setRetryVersion((value) => value + 1);
  }

  return (
    <>
      <div className="toolbar sticky community-toolbar">
        <div className="community-filters">
          <SearchBox
            value={search}
            onChange={setSearch}
            placeholder="Search community posts…"
          />
          <Dropdown
            ariaLabel="Filter category"
            value={category}
            onChange={setCategory}
            options={[
              { value: "", label: "All interests" },
              ...(cats.data || []).map((item) => ({
                value: String(item.id),
                label: item.name,
                iconName: item.icon,
              })),
            ]}
            hasIcon
          />
        </div>
        <button className="button" onClick={() => setCreate(true)}>
          <Plus size={18} /> Create a post
        </button>
      </div>

      <div className="feed-layout">
        <section className="community-feed">
          {loading ? (
            <div className="loading" role="status">
              <span className="spinner" /> Loading community posts…
            </div>
          ) : error && posts.length === 0 ? (
            <div className="notice error" role="alert">
              {error}
              <button onClick={retryInitialLoad}>Try again</button>
            </div>
          ) : posts.length ? (
            <>
              {posts.map((post) => (
                <ShowcasePost
                  key={post.id}
                  post={post}
                  onDeleted={refreshFeed}
                />
              ))}
              {error && (
                <div className="notice error" role="alert">
                  {error}
                  <button
                    onClick={() => {
                      setError("");
                      void loadMore(true);
                    }}
                  >
                    Try loading again
                  </button>
                </div>
              )}
              {loadingMore && (
                <div className="loading feed-loading" role="status">
                  <span className="spinner" /> Loading more posts…
                </div>
              )}
              {hasMore ? (
                <div
                  ref={sentinelRef}
                  className="infinite-scroll-sentinel"
                  aria-hidden="true"
                />
              ) : (
                <p className="feed-end">You’re all caught up.</p>
              )}
            </>
          ) : (
            <Empty
              title={
                query || category
                  ? "No posts match those filters"
                  : "Be the first to share"
              }
              text="Post an idea, a project or a small win."
            />
          )}
        </section>

        <aside className="card feed-aside">
          <Sparkles size={28} />
          <h2>
            Work in progress
            <br />
            is welcome.
          </h2>
          <p>
            You don’t need a finished masterpiece to share something worth
            seeing.
          </p>
          <hr />
          <h4>A thoughtful community</h4>
          <p>
            Give useful feedback. Credit your inspiration. Celebrate the effort.
          </p>
        </aside>
      </div>

      {create && (
        <Modal title="New post" onClose={() => setCreate(false)}>
          <PostForm
            categories={cats.data || []}
            onDone={async () => {
              setCreate(false);
              await refreshFeed();
            }}
          />
        </Modal>
      )}
    </>
  );
}

function PostForm({ categories, onDone }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [media, setMedia] = useState([]);

  function addMedia(event) {
    const files = Array.from(event.target.files || []);
    setMedia((current) => {
      const additions = files
        .filter(
          (file) =>
            /^(image|audio|video)\//.test(file.type) &&
            !current.some(
              (item) =>
                item.file.name === file.name &&
                item.file.size === file.size &&
                item.file.lastModified === file.lastModified,
            ),
        )
        .map((file) => ({ file, url: URL.createObjectURL(file) }));
      return [...current, ...additions];
    });
    event.target.value = "";
  }

  function removeMedia(index) {
    setMedia((current) => {
      URL.revokeObjectURL(current[index].url);
      return current.filter((_, position) => position !== index);
    });
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = new FormData(event.currentTarget);
      media.forEach(({ file }) => body.append("media", file));
      await api("showcase", { method: "POST", body });
      await onDone();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="form post-form">
      <div className="label-container">
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <label>
          What have you been working on?
          <textarea
            name="content"
            required
            maxLength={10000}
            rows={6}
            placeholder="Share your process, progress or next big idea…"
          />
        </label>
        <label>
          Interest
          <select name="category_id" required>
            <option value="">Choose an interest</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <div className="media-field">
          <span className="field-label">Add media</span>
          <label className="media-picker-button">
            <ImagePlus size={18} />
            Choose files
            <input
              type="file"
              accept="image/*,audio/*,video/*"
              multiple
              onChange={addMedia}
            />
          </label>
          {media.length > 0 && (
            <div className="media-preview-grid" aria-label="Selected media">
              {media.map(({ file, url }, index) => (
                <div
                  className="media-preview"
                  key={file.name + "-" + file.lastModified}
                >
                  {file.type.startsWith("image/") && (
                    <img src={url} alt={file.name} />
                  )}
                  {file.type.startsWith("video/") && (
                    <video src={url} controls />
                  )}
                  {file.type.startsWith("audio/") && (
                    <audio src={url} controls />
                  )}
                  <button
                    type="button"
                    className="media-remove"
                    aria-label={"Remove " + file.name}
                    onClick={() => removeMedia(index)}
                  >
                    <X size={15} />
                  </button>
                  <small title={file.name}>{file.name}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <input name="visibility" value="public" type="hidden" readOnly />
      <button className="button" disabled={busy || !categories.length}>
        <Send size={18} />
        {busy ? "Posting…" : "Publish post"}
      </button>
    </form>
  );
}

export function ShowcasePost({ post, detail = false, onDeleted }) {
  const user = useUser();
  const [liked, setLiked] = useState(Boolean(post.my_reaction));
  const [reactionCount, setReactionCount] = useState(Number(post.reactions) || 0);
  const [commentCount, setCommentCount] = useState(Number(post.comments) || 0);
  const [commentsOpen, setCommentsOpen] = useState(detail);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportStatus, setReportStatus] = useState("");

  useEffect(() => {
    setLiked(Boolean(post.my_reaction));
    setReactionCount(Number(post.reactions) || 0);
    setCommentCount(Number(post.comments) || 0);
  }, [post.id, post.my_reaction, post.reactions, post.comments]);

  async function toggleReaction() {
    const previousLiked = liked;
    setLiked(!previousLiked);
    setReactionCount((count) => Math.max(0, count + (previousLiked ? -1 : 1)));
    try {
      await api("frontend/showcase/" + post.id + "/reaction", {
        method: "PUT",
        body: { reaction: "love" },
      });
    } catch (requestError) {
      setLiked(previousLiked);
      setReactionCount((count) => Math.max(0, count + (previousLiked ? 1 : -1)));
      throw requestError;
    }
  }

  async function deletePost() {
    if (!confirm("Delete this post?")) return;
    await api("frontend/showcase/" + post.id, { method: "DELETE" });
    await onDeleted?.();
  }

  const canDelete = user.id === post.creator_id || user.role === "admin";
  const canReport = user.id !== post.creator_id;

  return (
    <article className={"card post" + (detail ? " post-detail" : "")}>
      <header>
        <span className="avatar">{post.creator_name?.[0]}</span>
        <div>
          <Link href={"/profile?user=" + post.creator_id}>
            <strong>{post.creator_name}</strong>
          </Link>
          <small>
            {date(post.created_at)} · {post.category_name}
          </small>
        </div>
        {(canDelete || canReport) && (
          <PostMenu
            canDelete={canDelete}
            canReport={canReport}
            onDelete={deletePost}
            onReport={() => {
              setReportStatus("");
              setReportOpen(true);
            }}
          />
        )}
      </header>

      {detail ? (
        <p className="post-content">{post.content}</p>
      ) : (
        <Link
          href={"/showcase/" + post.id}
          className="post-content-link"
          aria-label="Open full post"
        >
          <p className="post-content">{post.content}</p>
        </Link>
      )}

      {post.media?.length > 0 && (
        <div className="post-media">
          {post.media.map((item) => {
            const source =
              "/api/backend/frontend/showcase/" +
              post.id +
              "/media/" +
              item.id;
            if (item.mime_type.startsWith("image/")) {
              return (
                <img
                  key={item.id}
                  src={source}
                  alt={item.file_name || "Post media"}
                />
              );
            }
            if (item.mime_type.startsWith("video/")) {
              return <video key={item.id} src={source} controls />;
            }
            return <audio key={item.id} src={source} controls />;
          })}
        </div>
      )}

      <footer>
        <Action
          className={"reaction" + (liked ? " selected" : "")}
          aria-pressed={liked}
          onClick={toggleReaction}
        >
          <Heart size={18} /> {reactionCount} <span>Appreciate</span>
        </Action>
        {detail ? (
          <button
            type="button"
            className="reaction"
            onClick={() => setCommentsOpen((open) => !open)}
          >
            <MessageCircle size={18} /> {commentCount} <span>Comments</span>
          </button>
        ) : (
          <Link
            className="reaction"
            href={"/showcase/" + post.id + "#comments"}
          >
            <MessageCircle size={18} /> {commentCount} <span>Comments</span>
          </Link>
        )}
      </footer>

      {commentsOpen && (
        <Comments
          postId={post.id}
          onAdded={() => setCommentCount((count) => count + 1)}
        />
      )}
      {reportStatus && (
        <p className="report-success" role="status">
          {reportStatus}
        </p>
      )}
      {reportOpen && (
        <Modal title="Report post" onClose={() => setReportOpen(false)}>
          <ReportPostForm
            postId={post.id}
            onDone={() => {
              setReportOpen(false);
              setReportStatus("Thanks — your report was sent to the moderation team.");
            }}
          />
        </Modal>
      )}
    </article>
  );
}

function PostMenu({ canDelete, canReport, onDelete, onReport }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event) {
      if (!ref.current?.contains(event.target)) setOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="post-menu-wrap" ref={ref}>
      <button
        type="button"
        className="icon-button post-menu-trigger"
        aria-label="Post options"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Ellipsis size={19} />
      </button>
      {open && (
        <div className="floating-menu post-menu" role="menu">
          {canReport && (
            <button
              type="button"
              className="item"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onReport();
              }}
            >
              <Flag size={16} /> Report post
            </button>
          )}
          {canDelete && (
            <Action
              className="item red"
              role="menuitem"
              onClick={async () => {
                setOpen(false);
                await onDelete();
              }}
            >
              <Trash2 size={16} /> Delete post
            </Action>
          )}
        </div>
      )}
    </div>
  );
}

function ReportPostForm({ postId, onDone }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("showcase/" + postId + "/report", {
        method: "POST",
        body: { reason, details: details.trim() },
      });
      onDone();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form report-form" onSubmit={submit}>
      <p className="report-intro">
        Tell the moderation team why this post should be reviewed.
      </p>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <label>
        Reason
        <select required value={reason} onChange={(event) => setReason(event.target.value)}>
          <option value="">Choose a reason</option>
          <option value="spam">Spam or misleading content</option>
          <option value="harassment">Harassment or hateful content</option>
          <option value="inappropriate">Inappropriate content</option>
          <option value="other">Something else</option>
        </select>
      </label>
      <label>
        More details <span className="optional-label">(optional)</span>
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={2000}
          rows={4}
          placeholder="Add context that may help our review…"
        />
      </label>
      <button className="button report-submit" disabled={busy || !reason}>
        <Flag size={17} /> {busy ? "Sending report…" : "Submit report"}
      </button>
    </form>
  );
}

function Comments({ postId, onAdded }) {
  const resource = useResource("frontend/showcase/" + postId + "/comments");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  async function addComment() {
    await api("frontend/showcase/" + postId + "/comments", {
      method: "POST",
      body: { content: value },
    });
    setValue("");
    setError("");
    onAdded();
    resource.reload();
  }

  return (
    <div className="comments" id="comments">
      <State resource={resource}>
        {resource.data?.length ? (
          resource.data.map((comment) => (
            <CommentRow key={comment.id} comment={comment} />
          ))
        ) : (
          <p className="comment-empty">No comments yet. Start the conversation.</p>
        )}
      </State>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      <div className="comment-input">
        <input
          aria-label="Write a comment"
          placeholder="Leave a thoughtful comment…"
          value={value}
          maxLength={3000}
          onChange={(event) => setValue(event.target.value)}
        />
        <Action
          className="icon-button comment-send-button"
          aria-label="Send comment"
          disabled={!value.trim()}
          onClick={async () => {
            try {
              await addComment();
            } catch (requestError) {
              setError(requestError.message);
            }
          }}
        >
          <Send size={19} />
        </Action>
      </div>
    </div>
  );
}

function CommentRow({ comment }) {
  const [liked, setLiked] = useState(Boolean(comment.my_reaction));
  const [reactionCount, setReactionCount] = useState(Number(comment.reactions) || 0);

  async function toggleReaction() {
    const previousLiked = liked;
    setLiked(!previousLiked);
    setReactionCount((count) => Math.max(0, count + (previousLiked ? -1 : 1)));
    try {
      await api("frontend/comments/" + comment.id + "/reaction", {
        method: "PUT",
        body: { reaction: "love" },
      });
    } catch (requestError) {
      setLiked(previousLiked);
      setReactionCount((count) => Math.max(0, count + (previousLiked ? 1 : -1)));
      throw requestError;
    }
  }

  return (
    <div className="comment" key={comment.id}>
      <span className="avatar small">{comment.name?.[0]}</span>
      <div>
        <Link href={"/profile?user=" + comment.commenter_id}>
          <strong>{comment.name}</strong>
        </Link>
        <p>{comment.content}</p>
        <Action
          className={"reaction" + (liked ? " selected" : "")}
          aria-pressed={liked}
          onClick={toggleReaction}
        >
          <Heart size={14} /> {reactionCount}
        </Action>
      </div>
    </div>
  );
}
