"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(
      (data && (data.error as string)) || `Request failed (${res.status})`,
    ) as ApiError;
    err.status = res.status;
    err.code = data?.code;
    err.details = data?.details;
    throw err;
  }
  return data as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  return parse<T>(res);
}

export async function apiSend<T>(
  url: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body instanceof FormData ? undefined : { "content-type": "application/json" },
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });
  return parse<T>(res);
}

export const apiPost = <T,>(url: string, body?: unknown) => apiSend<T>(url, "POST", body);
export const apiPatch = <T,>(url: string, body?: unknown) => apiSend<T>(url, "PATCH", body);
export const apiPut = <T,>(url: string, body?: unknown) => apiSend<T>(url, "PUT", body);
export const apiDelete = <T,>(url: string) => apiSend<T>(url, "DELETE");

interface UseApiOptions {
  /** Poll interval in ms. Omit to fetch once. */
  refreshMs?: number;
  enabled?: boolean;
}

interface UseApiResult<T> {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  refresh: () => Promise<void>;
  mutate: (updater: (current: T | null) => T | null) => void;
}

/** Minimal data hook with optional polling — keeps the UI live without extra deps. */
export function useApi<T>(url: string | null, options: UseApiOptions = {}): UseApiResult<T> {
  const { refreshMs, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(url && enabled));
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const result = await apiGet<T>(url);
      if (mounted.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) setError(err as ApiError);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (!url || !enabled) return;
    setLoading(true);
    void load();
  }, [url, enabled, load]);

  useEffect(() => {
    if (!url || !refreshMs || !enabled) return;
    const id = setInterval(() => void load(), refreshMs);
    return () => clearInterval(id);
  }, [url, refreshMs, enabled, load]);

  const mutate = useCallback((updater: (current: T | null) => T | null) => {
    setData((current) => updater(current));
  }, []);

  return { data, error, loading, refresh: load, mutate };
}

/** Uploads a File in 8 MB chunks with progress — used for local video sources. */
export async function uploadVideo(
  file: File,
  settings: {
    title?: string;
    targetLength: number;
    requestedClips: number;
    aspect: string;
    subtitleStyle: string;
  },
  onProgress: (percent: number) => void,
): Promise<{ projectId: string; jobId: string }> {
  const init = await apiPost<{ uploadId: string; chunkSize: number }>("/api/upload/init", {
    fileName: file.name,
    size: file.size,
    mimeType: file.type,
  });
  const chunkSize = init.chunkSize || 8 * 1024 * 1024;
  let offset = 0;
  while (offset < file.size) {
    const slice = file.slice(offset, Math.min(file.size, offset + chunkSize));
    const res = await fetch(`/api/upload/${init.uploadId}/chunk`, {
      method: "PUT",
      credentials: "include",
      body: slice,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? "Chunk upload failed");
    }
    offset += slice.size;
    onProgress(Math.round((offset / file.size) * 92));
  }
  onProgress(96);
  const done = await apiPost<{ projectId: string; jobId: string }>(
    `/api/upload/${init.uploadId}/complete`,
    settings,
  );
  onProgress(100);
  return done;
}

export function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement("textarea");
  area.value = text;
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  document.execCommand("copy");
  document.body.removeChild(area);
  return Promise.resolve();
}
