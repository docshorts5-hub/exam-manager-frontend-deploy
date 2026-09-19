// src/features/audit/AuditTrailAgent.tsx
import React, { useEffect, useRef } from "react";
import { useAuth } from "../../auth/AuthContext";
import { appendAuditEntry, type AuditLevel } from "./auditTrail";

const IMPORTANT_ACTIONS = [
  "حفظ",
  "حذف",
  "إضافة",
  "اضافة",
  "تعديل",
  "استيراد",
  "رفع",
  "استعادة",
  "ترحيل",
  "تشغيل",
  "توزيع",
  "ربط",
  "فك ربط",
  "تعطيل",
  "تفعيل",
  "نشر",
  "مزامنة",
  "نسخ احتياطي",
  "سجل العمليات",
  "فحص الصلاحيات",
  "فحص التخزين",
  "الجاهزية التجارية",
  "إدارة",
  "دخول",
  "فتح",
  "اعتماد",
  "تحديث",
  "تنظيف",
  "تصدير",
  "backup",
  "restore",
  "save",
  "delete",
  "remove",
  "add",
  "edit",
  "update",
  "import",
  "upload",
  "sync",
  "run",
  "audit",
  "log",
];

const IGNORE_LABELS = new Set(["", "العربية", "english", "عربي", "en", "ar"]);

function clean(value: unknown) {
  return String(value || "").trim();
}

function readStorage(keys: string[]) {
  if (typeof window === "undefined") return "";
  for (const key of keys) {
    try {
      const value = window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
      if (value) return value;
    } catch {
      // ignore
    }
  }
  return "";
}

function tenantFromPath(pathname: string) {
  const match = pathname.match(/\/t\/([^/]+)/i);
  return match?.[1] || "";
}

function resolveLabel(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return "";
  const clickable = target.closest("button,a,[role='button'],input[type='submit'],input[type='button']") as HTMLElement | null;
  if (!clickable) return "";

  const aria = clickable.getAttribute("aria-label") || "";
  const title = clickable.getAttribute("title") || "";
  const value = clickable instanceof HTMLInputElement ? clickable.value : "";
  const text = clickable.textContent || "";

  return clean(aria || title || value || text).replace(/\s+/g, " ").slice(0, 160);
}

function classify(label: string): AuditLevel {
  const normalized = label.toLowerCase();
  if (["حذف", "delete", "remove", "استعادة", "restore", "تعطيل", "تنظيف", "مسح"].some((word) => normalized.includes(word))) {
    return "danger";
  }
  if (["حفظ", "تعديل", "edit", "update", "استيراد", "upload", "import", "تشغيل", "run", "توزيع", "مزامنة", "sync"].some((word) => normalized.includes(word))) {
    return "warning";
  }
  return "info";
}

function isImportant(label: string) {
  const normalized = label.toLowerCase();
  if (IGNORE_LABELS.has(normalized)) return false;
  if (IMPORTANT_ACTIONS.some((word) => normalized.includes(word.toLowerCase()))) return true;
  // نسجل الأزرار العامة أيضًا حتى لا تبقى صفحة السجل فارغة أثناء الاختبار.
  return normalized.length >= 3;
}

function pageLabel(pathname: string) {
  const cleanPath = pathname.replace(/^\/+/, "") || "الرئيسية";
  return `فتح صفحة: ${cleanPath}`;
}

export default function AuditTrailAgent() {
  const auth = useAuth() as any;
  const authRef = useRef<any>(auth);
  const lastRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const lastPathRef = useRef<string>(typeof window !== "undefined" ? window.location.pathname : "");

  authRef.current = auth;

  const buildContext = () => {
    const currentAuth = authRef.current || {};
    const pathname = typeof window !== "undefined" ? window.location.pathname || "" : "";
    return {
      path: pathname,
      tenantId:
        tenantFromPath(pathname) ||
        clean(currentAuth?.effectiveTenantId || currentAuth?.allow?.tenantId || currentAuth?.profile?.tenantId || currentAuth?.userProfile?.tenantId || readStorage(["effectiveTenantId", "selectedTenantId", "tenantId", "viewAsTenantId"])),
      userEmail: clean(currentAuth?.user?.email || currentAuth?.email || currentAuth?.allow?.email || readStorage(["currentUserEmail", "viewAsEmail", "userEmail"])),
      role: clean(currentAuth?.allow?.role || currentAuth?.profile?.role || currentAuth?.userProfile?.role || currentAuth?.effectiveRole || readStorage(["effectiveRole", "viewAsRole", "role"])),
      governorate: clean(currentAuth?.effectiveGovernorate || currentAuth?.allow?.governorate || currentAuth?.profile?.governorate || currentAuth?.userProfile?.governorate || readStorage(["effectiveGovernorate", "governorateSuperScope", "governorate"])),
      readOnly: Boolean(currentAuth?.readOnly || currentAuth?.allow?.readOnly || readStorage(["viewAsReadOnly", "governorateSuperReadOnly", "readOnly"])),
    };
  };

  useEffect(() => {
    const writeEntry = (label: string, action: string, level?: AuditLevel) => {
      if (!label || !isImportant(label)) return;
      const context = buildContext();
      const key = `${context.path}::${action}::${label}`;
      const now = Date.now();
      if (lastRef.current.key === key && now - lastRef.current.at < 1200) return;
      lastRef.current = { key, at: now };

      appendAuditEntry({
        level: level || classify(label),
        action,
        label,
        path: context.path,
        tenantId: context.tenantId,
        userEmail: context.userEmail,
        role: context.role,
        governorate: context.governorate,
        readOnly: context.readOnly,
        source: "client-audit-agent",
      });
    };

    const onClick = (event: MouseEvent) => {
      const label = resolveLabel(event.target);
      writeEntry(label, "click");
    };

    const onRouteChange = () => {
      const pathname = window.location.pathname || "";
      if (!pathname || pathname === lastPathRef.current) return;
      lastPathRef.current = pathname;
      writeEntry(pageLabel(pathname), "page_view", "info");
    };

    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function pushStatePatched(...args: Parameters<History["pushState"]>) {
      const result = originalPushState.apply(window.history, args);
      window.dispatchEvent(new Event("exam-manager:route-change"));
      return result;
    } as History["pushState"];

    window.history.replaceState = function replaceStatePatched(...args: Parameters<History["replaceState"]>) {
      const result = originalReplaceState.apply(window.history, args);
      window.dispatchEvent(new Event("exam-manager:route-change"));
      return result;
    } as History["replaceState"];

    window.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onRouteChange);
    window.addEventListener("exam-manager:route-change", onRouteChange);

    // تسجيل فتح الصفحة الحالية مرة واحدة بعد تركيب المكوّن.
    setTimeout(() => writeEntry(pageLabel(window.location.pathname || "/"), "page_view", "info"), 250);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onRouteChange);
      window.removeEventListener("exam-manager:route-change", onRouteChange);
    };
  }, []);

  return null;
}
