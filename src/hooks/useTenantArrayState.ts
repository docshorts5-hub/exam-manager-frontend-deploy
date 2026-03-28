import { useEffect, useRef, useState } from "react";

type Options<T> = {
  tenantId: string;
  userId?: string;
  load: (tenantId: string) => Promise<T[]>;
  save: (tenantId: string, items: T[], userId?: string) => Promise<void>;
  subscribe?: (
    tenantId: string,
    onChange: (items: T[]) => void,
    onError?: (err: unknown) => void
  ) => () => void;
};

export function useTenantArrayState<T>({
  tenantId,
  userId,
  load,
  save,
  subscribe,
}: Options<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const unsubscribeRef = useRef<null | (() => void)>(null);
  const subscribedTenantRef = useRef<string>("");

  useEffect(() => {
    if (!tenantId) {
      setItems([]);
      setLoading(false);
      setLoaded(false);
      setError("");
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      subscribedTenantRef.current = "";
      return;
    }

    let active = true;

    async function init() {
      try {
        setLoading(true);
        setError("");

        const data = await load(tenantId);
        if (!active) return;

        setItems(data || []);
        setLoaded(true);

        if (subscribe && subscribedTenantRef.current !== tenantId) {
          unsubscribeRef.current?.();

          unsubscribeRef.current = subscribe(
            tenantId,
            (next) => {
              if (!active) return;
              setItems(next || []);
              setLoaded(true);
              setLoading(false);
            },
            (err) => {
              console.error(err);
              if (!active) return;
              setError("حدث خطأ في التحديث اللحظي");
              setLoading(false);
            }
          );

          subscribedTenantRef.current = tenantId;
        }
      } catch (err) {
        console.error(err);
        if (!active) return;
        setError("فشل تحميل البيانات");
      } finally {
        if (active) setLoading(false);
      }
    }

    void init();

    return () => {
      active = false;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      subscribedTenantRef.current = "";
    };
  }, [tenantId, load, subscribe]);

  const persistNow = async (next: T[]) => {
    if (!tenantId) return;

    try {
      setSaving(true);
      setError("");
      await save(tenantId, next, userId);
    } catch (err) {
      console.error(err);
      setError("فشل الحفظ");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const reload = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      setError("");
      const data = await load(tenantId);
      setItems(data || []);
      setLoaded(true);
    } catch (err) {
      console.error(err);
      setError("فشل إعادة التحميل");
      throw err;
    } finally {
      setLoading(false);
    }
  };

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
