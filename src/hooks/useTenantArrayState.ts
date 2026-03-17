import { useEffect, useRef, useState } from "react";

type UseTenantArrayStateOptions<T> = {
  tenantId: string;
  userId?: string;
  load: (tenantId: string) => Promise<T[]>;
  save: (tenantId: string, items: T[], userId?: string) => Promise<void>;
  debounceMs?: number;
  enabled?: boolean;
};

export function useTenantArrayState<T>(options: UseTenantArrayStateOptions<T>) {
  const {
    tenantId,
    userId,
    load,
    save,
    debounceMs = 600,
    enabled = true,
  } = options;

  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didLoadRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!enabled || !tenantId) {
        if (!mounted) return;
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
        setItems(Array.isArray(next) ? next : []);
      } catch (err) {
        if (!mounted) return;
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
    if (!enabled || !tenantId || !didLoadRef.current) return;
    const timer = window.setTimeout(() => {
      void save(tenantId, items, userId).catch((err) => {
        setError(err instanceof Error ? err.message : "failed_to_save");
      });
    }, debounceMs);
    return () => window.clearTimeout(timer);
  }, [items, tenantId, userId, save, debounceMs, enabled]);

  async function reload() {
    if (!enabled || !tenantId) {
      setItems([]);
      setLoaded(true);
      didLoadRef.current = true;
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await load(tenantId);
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
    await save(tenantId, payload, userId);
  }

  return {
    items,
    setItems,
    loading,
    loaded,
    error,
    reload,
    persistNow,
  };
}
