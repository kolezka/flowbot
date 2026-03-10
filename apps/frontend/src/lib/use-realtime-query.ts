"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSocketEvent } from "./websocket";

interface UseRealtimeQueryOptions<T> {
  queryFn: () => Promise<T>;
  wsEvent?: string;
  wsRoom?: string;
  refetchInterval?: number;
}

export function useRealtimeQuery<T>({
  queryFn,
  wsEvent,
  refetchInterval,
}: UseRealtimeQueryOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  const fetch = useCallback(async () => {
    try {
      const result = await queryFnRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!refetchInterval) return;
    const id = setInterval(fetch, refetchInterval);
    return () => clearInterval(id);
  }, [fetch, refetchInterval]);

  // Refetch on WebSocket event
  useSocketEvent(wsEvent ?? '__noop__', () => {
    fetch();
  });

  return { data, loading, error, refetch: fetch };
}
