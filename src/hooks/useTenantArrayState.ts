import { useEffect, useRef, useState } from "react";

type Options<T> = {
  tenantId: string;
  userId?: string;
  load: (tenantId: string) => Promise<T[]>;
  save: (tenantId: string, items: T[], userId?: string) => Promise<void>;
  subscribe?: (
    tenantId: string,
    onChange: (items: T[]) => void,
    onError?: (err: any) => void
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
  const initializedRef = useRef(false);

  // ✅ LOAD + SUBSCRIBE (مرة واحدة فقط)
  useEffect(() => {
    if (!tenantId) return;

    let active = true;

    async function init() {
      try {
        setLoading(true);
        const data = await load(tenantId);

        if (!active) return;

        setItems(data || []);
        setLoaded(true);
        setError("");

        // ✅ subscribe مرة واحدة فقط
        if (subscribe && !initializedRef.current) {
          unsubscribeRef.current?.();

          unsubscribeRef.current = subscribe(
            tenantId,
            (next) => {
              setItems(next || []);
            },
            (err) => {
              console.error(err);
              setError("حدث خطأ في التحديث اللحظي");
            }
          );

          initializedRef.current = true;
        }
      } catch (err) {
        console.error(err);
        setError("فشل تحميل البيانات");
      } finally {
        if (active) setLoading(false);
      }
    }

    init();

    return () => {
      active = false;
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
      initializedRef.current = false;
    };
  }, [tenantId]); // 🔥 أهم نقطة

  // ✅ حفظ بدون loop
  const persistNow = async (next: T[]) => {
    if (!tenantId) return;

    try {
      setSaving(true);
      await save(tenantId, next, userId);
    } catch (err) {
      console.error(err);
      setError("فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const reload = async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      const data = await load(tenantId);
      setItems(data || []);
    } catch (err) {
      console.error(err);
      setError("فشل إعادة التحميل");
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
