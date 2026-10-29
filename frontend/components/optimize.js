"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { canOptimize, formatSize, optimizeFile } from "@/lib/optimize-media";

/**
 * Runs the upload optimiser and reports what it is doing, for any place that lets a person choose a file.
 *   const optimizer = useOptimizer();
 *   const file = await optimizer.run(chosenFile, "avatar");   // resolves to the optimised file (or the original)
 *   <OptimizeStatus {...optimizer} />
 */
export function useOptimizer({ onBusy } = {}) {
  const [state, setState] = useState({ busy: false, slow: false, progress: 0, name: "", result: null });
  const controller = useRef(null);
  const busyRef = useRef(onBusy);
  busyRef.current = onBusy;

  const run = useCallback(async (file, preset) => {
    if (!file || !canOptimize(file)) {
      setState({ busy: false, slow: false, progress: 0, name: "", result: null });
      return file;
    }
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const slow = !file.type.startsWith("image/");
    setState({ busy: true, slow, progress: 0, name: file.name, result: null });
    busyRef.current?.(true);
    try {
      const result = await optimizeFile(file, { preset, signal: current.signal, onProgress: slow ? (progress) => setState((value) => ({ ...value, progress })) : undefined });
      setState({ busy: false, slow, progress: 1, name: "", result });
      return result.file;
    } finally {
      busyRef.current?.(false);
    }
  }, []);

  const skip = useCallback(() => controller.current?.abort(), []);
  useEffect(() => () => controller.current?.abort(), []);
  const clear = useCallback(() => setState({ busy: false, slow: false, progress: 0, name: "", result: null }), []);
  return { ...state, run, skip, clear };
}

/** "Optimizing video… 43%  Skip" while working, and "Optimized for upload: 18 MB → 6.1 MB" afterwards. */
export function OptimizeStatus({ busy, slow, progress, name, result, skip }) {
  if (busy)
    return (
      <p className="opt-status busy" role="status">
        <span className="spinner" aria-hidden="true" />
        <span>
          Optimizing {name ? <strong>{name}</strong> : "your file"}
          {slow ? ` … ${Math.round(progress * 100)}%` : "…"}
        </span>
        {slow && skip && (
          <button type="button" onClick={skip}>
            Skip
          </button>
        )}
      </p>
    );
  if (result?.changed)
    return (
      <p className="opt-status done" role="status">
        <Check size={14} aria-hidden="true" />
        <span>
          Optimized for upload: {formatSize(result.before)} → {formatSize(result.after)} ({Math.max(1, Math.round((1 - result.after / result.before) * 100))}% smaller)
        </span>
      </p>
    );
  return null;
}

/**
 * A plain file input whose chosen file is optimised before the form is sent. The optimised file replaces the chosen one
 * inside the input, so a form that reads the input (FormData) needs no other change.
 *   preset  picture size to aim for ("course", "instructor" ...)    onBusy(true|false)  tells the form to wait
 */
export function OptimizedFileInput({ preset, onChange, onBusy, ...props }) {
  const optimizer = useOptimizer({ onBusy });
  async function handle(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) {
      optimizer.clear();
      onChange?.(event);
      return;
    }
    const optimized = await optimizer.run(file, preset);
    if (optimized !== file) {
      const transfer = new DataTransfer();
      transfer.items.add(optimized);
      input.files = transfer.files;
    }
    onChange?.({ target: input, currentTarget: input });
  }
  return (
    <>
      <input {...props} type="file" onChange={handle} />
      <OptimizeStatus {...optimizer} />
    </>
  );
}
