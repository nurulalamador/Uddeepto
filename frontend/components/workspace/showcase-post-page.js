"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useResource, State } from "../ui";
import { ShowcasePost } from "./showcase";
import { useShellActions, useUser } from "../shell";

export default function ShowcasePostPage({ postId }) {
  const router = useRouter();
  const user = useUser();
  const { setDetailSubtitle } = useShellActions();
  const resource = useResource("frontend/showcase/" + postId);

  useEffect(() => {
    setDetailSubtitle(resource.data?.creator_name ? `${resource.data.creator_name}'s post` : "Post");
    return () => setDetailSubtitle("Post");
  }, [resource.data?.creator_name, setDetailSubtitle]);

  useEffect(() => {
    if (!resource.data || window.location.hash !== "#comments") return;
    const timer = setTimeout(() => {
      document
        .getElementById("comments")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
    return () => clearTimeout(timer);
  }, [resource.data]);

  return <div className="post-detail-content">
    <State resource={resource}>
      {resource.data && <ShowcasePost post={resource.data} detail onDeleted={() => router.replace(user.role === "admin" ? "/moderation" : "/showcase")} />}
    </State>
  </div>;
}
