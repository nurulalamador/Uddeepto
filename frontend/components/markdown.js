"use client";

import { Children, isValidElement, memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";

/** Gemini often writes \( … \) and \[ … \] for maths; remark-math expects $ … $ and $$ … $$. */
export function normalizeMarkdown(source) {
  return String(source)
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, index) =>
      index % 2 === 1
        ? part
        : part
            .replace(/\\\[([\s\S]+?)\\\]/g, (_match, math) => `\n$$\n${math.trim()}\n$$\n`)
            .replace(/\\\(([\s\S]+?)\\\)/g, (_match, math) => `$${math.trim()}$`)
            // A line that is only "$$ … $$" should be a centred display equation.
            .replace(/^[ \t]*\$\$([^\n$]+?)\$\$[ \t]*$/gm, (_match, math) => `\n$$\n${math.trim()}\n$$\n`),
    )
    .join("");
}

function textOf(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf(node.props.children);
  return "";
}

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const code = Children.toArray(children).find(isValidElement);
  const language = /language-([\w-]+)/.exec(code?.props?.className || "")?.[1] || "";
  const text = textOf(code?.props?.children).replace(/\n$/, "");
  return (
    <div className="md-code">
      <div className="md-code-head">
        <span>{language || "code"}</span>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              /* clipboard unavailable */
            }
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>{children}</pre>
    </div>
  );
}

const components = {
  pre: CodeBlock,
  a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer noopener" />,
  table: ({ node, ...props }) => (
    <div className="md-table">
      <table {...props} />
    </div>
  ),
};

function Markdown({ children }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: "ignore" }], [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={components}
      >
        {normalizeMarkdown(children)}
      </ReactMarkdown>
    </div>
  );
}

export default memo(Markdown);
