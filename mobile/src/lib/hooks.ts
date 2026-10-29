import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export type Resource<T> = { data: T | null; error: string; loading: boolean; refreshing: boolean; reload: () => Promise<void>; refresh: () => Promise<void>; setData: (value: T | null | ((current: T | null) => T | null)) => void };

/** Loads `path` (skipped while it is null) and reloads when the path changes. */
export function useApi<T = any>(path: string | null): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(path));
  const [refreshing, setRefreshing] = useState(false);
  const live = useRef(0);

  const load = useCallback(
    async (quiet: boolean) => {
      if (!path) {
        setData(null);
        setLoading(false);
        return;
      }
      const run = ++live.current;
      if (!quiet) setLoading(true);
      setError("");
      try {
        const result = await api<T>(path);
        if (run === live.current) setData(result);
      } catch (problem: any) {
        if (run === live.current) setError(problem.message || "Something went wrong");
      } finally {
        if (run === live.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [path],
  );

  useEffect(() => {
    setData(null);
    load(false);
    return () => {
      live.current++;
    };
  }, [load]);

  const reload = useCallback(() => load(true), [load]);
  const refresh = useCallback(() => {
    setRefreshing(true);
    return load(true);
  }, [load]);
  return { data, error, loading, refreshing, reload, refresh, setData };
}

/** A list that loads a page at a time. `path` already contains its other query parameters. */
export function usePaged<T = any>(path: string | null, pageSize = 15) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(Boolean(path));
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [more, setMore] = useState(false);
  const run = useRef(0);
  const offset = useRef(0);

  const fetchPage = useCallback(
    async (reset: boolean, quiet = false) => {
      if (!path) {
        setItems([]);
        setLoading(false);
        return;
      }
      const mine = ++run.current;
      if (reset) {
        offset.current = 0;
        if (!quiet) setLoading(true);
      } else setLoadingMore(true);
      setError("");
      try {
        const join = path.includes("?") ? "&" : "?";
        const result = await api<T[] | { items: T[]; has_more: boolean }>(`${path}${join}limit=${pageSize}&offset=${offset.current}`);
        if (mine !== run.current) return;
        const page = Array.isArray(result) ? result : result.items;
        setItems((current) => (reset ? page : [...current, ...page.filter((row: any) => !current.some((known: any) => known.id === row.id))]));
        setMore(Array.isArray(result) ? page.length === pageSize : result.has_more);
        offset.current += page.length;
      } catch (problem: any) {
        if (mine === run.current) setError(problem.message || "Something went wrong");
      } finally {
        if (mine === run.current) {
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [path, pageSize],
  );

  useEffect(() => {
    setItems([]);
    fetchPage(true);
    return () => {
      run.current++;
    };
  }, [fetchPage]);

  return {
    items,
    setItems,
    loading,
    loadingMore,
    refreshing,
    error,
    hasMore: more,
    loadMore: () => {
      if (more && !loading && !loadingMore) fetchPage(false);
    },
    refresh: () => {
      setRefreshing(true);
      fetchPage(true, true);
    },
    reload: () => fetchPage(true, true),
  };
}

/** A value that follows `value` after it has stopped changing for `delay` ms. */
export function useDebounced<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export type Category = { id: string; name: string; icon?: string };
let cachedCategories: Category[] | null = null;
/** The interest categories every filter and form offers (loaded once). */
export function useCategories() {
  const [list, setList] = useState<Category[]>(cachedCategories || []);
  useEffect(() => {
    if (cachedCategories) return;
    api<Category[]>("users/interests")
      .then((rows) => {
        cachedCategories = rows;
        setList(rows);
      })
      .catch(() => {});
  }, []);
  return list;
}
