import { useEffect, useRef, useState } from "react";

type UseTenantArrayStateOptions<T> = {
  tenantId: string;
  userId?: string;
  load: (tenantId: string) => Promise<T[]>;
  save: (tenantId: string, items: T[], userId?: string) => Promise<void>;
  subscribe?: (tenantId: string, onChange: (items: T[]) => void, onError?: (error: unknown) => void) => (() => void) | void;
  debounceMs?: number;
  enabled?: boolean;
};

export function useTenantArrayState<T>(options: UseTenantArrayStateOptions<T>) {
  const {
    tenantId,
    userId,
    load,
    save,
    subscribe,
    debounceMs = 600,
    enabled = true,
  } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const didLoadRef = useRef(false);
  const suppressNextSaveRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!enabled || !tenantId) {
        if (!mounted) return;
        suppressNextSaveRef.current += 1;
        setItems([]);
        setLoading(false);
        setLoaded(true);
        didLoadRef.current = true;
        return;
      }

      setLoading(true);
      setLoaded(false);
      setError(null);
      try {
        const next = await load(tenantId);
        if (!mounted) return;
        suppressNextSaveRef.current += 1;
        setItems(Array.isArray(next) ? next : []);
      } catch (err) {
        if (!mounted) return;
        suppressNextSaveRef.current += 1;
        setItems([]);
        setError(err instanceof Error ? err.message : "failed_to_load");
      } finally {
        if (!mounted) return;
        setLoading(false);
        setLoaded(true);
        didLoadRef.current = true;
      }
    }

    void run();
    return () => {
      mounted = false;
    };
  }, [tenantId, enabled, load]);

  useEffect(() => {
    if (!enabled || !tenantId || !subscribe) return;
    const unsub = subscribe(
      tenantId,
      (next) => {
        suppressNextSaveRef.current += 1;
        setItems(Array.isArray(next) ? next : []);
        setLoading(false);
        setLoaded(true);
        setError(null);
        didLoadRef.current = true;
      },
      (err) => {
        setError(err instanceof Error ? err.message : "failed_to_subscribe");
      }
    );
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [tenantId, enabled, subscribe]);

  useEffect(() => {
    if (!enabled || !tenantId || !didLoadRef.current) return;
    if (suppressNextSaveRef.current > 0) {
      suppressNextSaveRef.current -= 1;
      return;
    }
    const timer = window.setTimeout(() => {
      setSaving(true);
      void save(tenantId, items, userId)
        .catch((err) => {
          setError(err instanceof Error ? err.message : "failed_to_save");
        })
        .finally(() => {
          setSaving(false);
        });
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [items, tenantId, userId, save, debounceMs, enabled]);

  async function reload() {
    if (!enabled || !tenantId) {
      suppressNextSaveRef.current += 1;
      setItems([]);
      setLoaded(true);
      didLoadRef.current = true;
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await load(tenantId);
      suppressNextSaveRef.current += 1;
      setItems(Array.isArray(next) ? next : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed_to_load");
    } finally {
      setLoading(false);
      setLoaded(true);
      didLoadRef.current = true;
    }
  }

  async function persistNow(nextItems?: T[]) {
    if (!enabled || !tenantId) return;
    const payload = Array.isArray(nextItems) ? nextItems : items;
    setSaving(true);
    try {
      await save(tenantId, payload, userId);
    } finally {
      setSaving(false);
    }
  }

  return {
    items,
    setItems,
    loading,
    loaded,
    error,
    saving,
    reload,
    persistNow,
  };
}
