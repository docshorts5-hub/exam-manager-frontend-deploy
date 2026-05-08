import { useCallback, useEffect, useMemo, useState } from "react";
import { onSnapshot, orderBy, query } from "firebase/firestore";
import { createTenantRepo } from "../../../services/tenantRepo";
import { fetchCloudArchiveViaService, mergeArchiveItems } from "../services/archiveService";
import type { ArchiveItem } from "../types";
import { callFn } from "../../../services/functionsClient";

export function useArchiveItems(tenantId: string, refreshToken = 0) {
  const [cloudItems, setCloudItems] = useState<ArchiveItem[]>([]);
  const [cloudOk, setCloudOk] = useState(false);
  const [cloudErr, setCloudErr] = useState("");
  const [cloudStatus, setCloudStatus] = useState<{ ok: boolean; note: string }>({ ok: false, note: "لم يتم الفحص بعد" });

  useEffect(() => {
    if (!tenantId) return;
    try {
      const repo = createTenantRepo(tenantId);
      const q = query(repo.archive, (orderBy as any)("createdAt", "desc"));
      return onSnapshot(
        q,
        (snap) => {
          const rows = snap.docs.map((d) => ({ archiveId: d.id, ...(d.data() as any) })) as ArchiveItem[];
          setCloudItems(rows);
          setCloudOk(true);
          setCloudErr("");
        },
        async (err) => {
          setCloudItems([]);
          setCloudOk(false);
          setCloudErr(String((err as any)?.message || "cloud-unavailable"));
          try {
            const rows = await fetchCloudArchiveViaService(tenantId);
            if (rows.length) {
              setCloudItems(rows);
              setCloudOk(true);
              setCloudErr("");
            }
          } catch (e2: any) {
            setCloudOk(false);
            setCloudErr(String(e2?.message || (err as any)?.message || "cloud-unavailable"));
          }
        }
      );
    } catch {
      setCloudItems([]);
      setCloudOk(false);
      setCloudErr("cloud-unavailable");
      return;
    }
  }, [tenantId]);

  const items = useMemo(() => mergeArchiveItems(tenantId, cloudItems), [tenantId, cloudItems, refreshToken]);

  const checkCloud = useCallback(async () => {
    try {
      const list = callFn<any, any>("tenantListDocs");
      await list({ tenantId, sub: "archive", limit: 1, orderBy: "createdAt", orderDir: "desc" });
      setCloudStatus({ ok: true, note: "Cloud Functions: OK (tenantListDocs)" });
      return;
    } catch (e: any) {
      const code = String(e?.code || "");
      const msg = String(e?.message || "");
      if (code === "FUNCTIONS_DISABLED" || msg.includes("FUNCTIONS_DISABLED")) {
        setCloudStatus({ ok: false, note: "Cloud Functions معطّلة (ضع VITE_DISABLE_FUNCTIONS=false في .env)" });
        return;
      }
      if (code === "unauthenticated" || msg.includes("AUTH_REQUIRED")) {
        setCloudStatus({ ok: false, note: "غير مسجل دخول (AUTH_REQUIRED)" });
        return;
      }
      const m = cloudErr || msg || "cloud-unavailable";
      if (m.toLowerCase().includes("permission") || m.toLowerCase().includes("insufficient")) {
        setCloudStatus({ ok: false, note: "Firestore Read مرفوض (permission-denied). استخدم tenantListDocs." });
      } else {
        setCloudStatus({ ok: false, note: `Cloud غير متاح (${m})` });
      }
    }
  }, [tenantId, cloudErr]);

  return { items, cloudOk, cloudErr, cloudStatus, checkCloud };
}
