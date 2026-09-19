import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

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

  const [items, setItemsState] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const didLoadRef = useRef(false);
  const suppressNextSaveRef = useRef(0);
  const itemsRef = useRef<T[]>([]);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const replaceItemsFromSource = useCallback((next: T[]) => {
    const safeNext = Array.isArray(next) ? next : [];
    itemsRef.current = safeNext;
    setItemsState(safeNext);
  }, []);

  const enqueueSave = useCallback(
    (payload: T[], options?: { throwOnError?: boolean }) => {
      if (!enabled || !tenantId) return Promise.resolve();

      setSaving(true);
      setError(null);

      const safePayload = Array.isArray(payload) ? payload : [];

      const runSave = () =>
        save(tenantId, safePayload, userId).catch((err) => {
          if (mountedRef.current) {
            setError(err instanceof Error ? err.message : "failed_to_save");
          }
          if (options?.throwOnError) throw err;
        });

      const queued = saveQueueRef.current.catch(() => undefined).then(runSave);
      saveQueueRef.current = queued.finally(() => {
        if (mountedRef.current) setSaving(false);
      });

      return saveQueueRef.current;
    },
    [enabled, tenantId, userId, save]
  );

  const setItems: Dispatch<SetStateAction<T[]>> = useCallback(
    (nextAction) => {
      const current = itemsRef.current;
      const resolved = typeof nextAction === "function" ? (nextAction as (prev: T[]) => T[])(current) : nextAction;
      const payload = Array.isArray(resolved) ? resolved : [];

      itemsRef.current = payload;

      // The user action is saved immediately. This prevents data from disappearing
      // when the user navigates away before the previous debounced autosave fires.
      suppressNextSaveRef.current += 1;
      setItemsState(payload);

      if (didLoadRef.current) {
        void enqueueSave(payload);
      }
    },
    [enqueueSave]
  );

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!enabled || !tenantId) {
        if (!mounted) return;
        suppressNextSaveRef.current += 1;
        replaceItemsFromSource([]);
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
        replaceItemsFromSource(Array.isArray(next) ? next : []);
      } catch (err) {
        if (!mounted) return;
        suppressNextSaveRef.current += 1;
        replaceItemsFromSource([]);
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
  }, [tenantId, enabled, load, replaceItemsFromSource]);

  useEffect(() => {
    if (!enabled || !tenantId || !subscribe) return;
    const unsub = subscribe(
      tenantId,
      (next) => {
        suppressNextSaveRef.current += 1;
        replaceItemsFromSource(Array.isArray(next) ? next : []);
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
  }, [tenantId, enabled, subscribe, replaceItemsFromSource]);

  useEffect(() => {
    if (!enabled || !tenantId || !didLoadRef.current) return;
    if (suppressNextSaveRef.current > 0) {
      suppressNextSaveRef.current -= 1;
      return;
    }

    const timer = window.setTimeout(() => {
      void enqueueSave(items);
    }, debounceMs);

    return () => window.clearTimeout(timer);
  }, [items, tenantId, enqueueSave, debounceMs, enabled]);


  useEffect(() => {
    if (!enabled || !tenantId) return;

    const onTenantDataChanged = (event: Event) => {
      const detail = (event as CustomEvent)?.detail || {};
      const changedTenantId = String(detail?.tenantId || "").trim();
      if (changedTenantId && changedTenantId !== String(tenantId).trim()) return;

      // Reload from Firestore when another tab/page updates the same tenant collection.
      // This keeps the current device and other opened pages aligned with the cloud.
      void (async () => {
        try {
          const next = await load(tenantId);
          suppressNextSaveRef.current += 1;
          replaceItemsFromSource(Array.isArray(next) ? next : []);
          setError(null);
          setLoaded(true);
          didLoadRef.current = true;
        } catch (err) {
          setError(err instanceof Error ? err.message : "failed_to_reload_after_cloud_change");
        }
      })();
    };

    window.addEventListener("exam-manager:tenant-data-changed", onTenantDataChanged as EventListener);
    window.addEventListener("exam-manager:cloud-storage:changed", onTenantDataChanged as EventListener);

    return () => {
      window.removeEventListener("exam-manager:tenant-data-changed", onTenantDataChanged as EventListener);
      window.removeEventListener("exam-manager:cloud-storage:changed", onTenantDataChanged as EventListener);
    };
  }, [tenantId, enabled, load, replaceItemsFromSource]);

  async function reload() {
    if (!enabled || !tenantId) {
      suppressNextSaveRef.current += 1;
      replaceItemsFromSource([]);
      setLoaded(true);
      didLoadRef.current = true;
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await load(tenantId);
      suppressNextSaveRef.current += 1;
      replaceItemsFromSource(Array.isArray(next) ? next : []);
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
    const payload = Array.isArray(nextItems) ? nextItems : itemsRef.current;

    // Update the UI immediately, but prevent the debounced autosave
    // from saving the same payload twice.
    if (Array.isArray(nextItems)) {
      suppressNextSaveRef.current += 1;
      replaceItemsFromSource(payload);
    }

    await enqueueSave(payload, { throwOnError: true });
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
