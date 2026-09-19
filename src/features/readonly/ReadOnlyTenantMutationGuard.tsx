import React, { useEffect, useMemo, useState } from "react";

type Props = {
  active: boolean;
  children: React.ReactNode;
};

const BLOCKED_ACTION_WORDS = [
  "حفظ",
  "إضافة",
  "اضافة",
  "جديد",
  "إنشاء",
  "انشاء",
  "حذف",
  "مسح",
  "إزالة",
  "ازالة",
  "تعديل",
  "تحديث البيانات",
  "اعتماد",
  "ترحيل",
  "رفع",
  "استيراد",
  "استعادة",
  "مزامنة",
  "ربط",
  "فك الربط",
  "تشغيل",
  "توزيع",
  "تصحيح",
  "save",
  "add",
  "create",
  "new",
  "delete",
  "remove",
  "edit",
  "update data",
  "submit",
  "import",
  "upload",
  "sync",
  "restore",
  "run",
  "generate",
  "assign",
  "migrate",
  "link",
  "unlink",
];

const ALLOWED_WORDS = [
  "عودة",
  "رجوع",
  "خروج",
  "تسجيل خروج",
  "إلغاء",
  "الغاء",
  "بحث",
  "تصفية",
  "عرض",
  "مشاهدة",
  "فتح",
  "طباعة",
  "تحميل",
  "تنزيل",
  "تصدير",
  "english",
  "العربية",
  "back",
  "return",
  "logout",
  "sign out",
  "cancel",
  "search",
  "filter",
  "view",
  "open",
  "print",
  "download",
  "export",
];

function normalizeText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[ـًٌٍَُِّْ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function elementText(el: Element | null) {
  if (!el) return "";
  const anyEl = el as HTMLElement;
  return normalizeText([
    anyEl.innerText,
    anyEl.textContent,
    anyEl.getAttribute("aria-label"),
    anyEl.getAttribute("title"),
    anyEl.getAttribute("data-action"),
    anyEl.getAttribute("name"),
    anyEl.getAttribute("value"),
    anyEl.className ? String(anyEl.className) : "",
  ].filter(Boolean).join(" "));
}

function isAllowedElement(el: Element | null) {
  const text = elementText(el);
  if (!text) return false;
  return ALLOWED_WORDS.some((word) => text.includes(normalizeText(word)));
}

function isBlockedElement(el: Element | null) {
  if (!el) return false;
  const htmlEl = el as HTMLElement;
  const tag = htmlEl.tagName.toLowerCase();
  const text = elementText(el);

  if (htmlEl.closest?.('[data-readonly-allow="true"], .readonly-allow, .ro-allow')) return false;
  if (isAllowedElement(el)) return false;

  if (tag === "input") {
    const input = htmlEl as HTMLInputElement;
    const type = String(input.type || "").toLowerCase();
    if (["file", "submit", "reset"].includes(type)) return true;
  }

  if (tag === "button") {
    const button = htmlEl as HTMLButtonElement;
    const type = String(button.type || "button").toLowerCase();
    if (type === "submit") return true;
  }

  return BLOCKED_ACTION_WORDS.some((word) => text.includes(normalizeText(word)));
}

function findActionElement(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest("button, a, input, [role='button'], [data-action]");
}

function markBlockedControls() {
  const controls = Array.from(document.querySelectorAll("button, a, input, [role='button'], [data-action]"));
  controls.forEach((el) => {
    if (isBlockedElement(el)) {
      (el as HTMLElement).setAttribute("data-readonly-blocked", "true");
      (el as HTMLElement).setAttribute("title", "وضع مشاهدة فقط - هذا الإجراء غير متاح لمشرف المحافظة");
      if (el.tagName.toLowerCase() === "input") {
        const input = el as HTMLInputElement;
        if (["file", "submit", "reset"].includes(String(input.type || "").toLowerCase())) input.disabled = true;
      }
    } else {
      (el as HTMLElement).removeAttribute("data-readonly-blocked");
    }
  });
}

export default function ReadOnlyTenantMutationGuard({ active, children }: Props) {
  const [messageVisible, setMessageVisible] = useState(false);

  const readonlyStyle = useMemo(() => `
    body.tenant-readonly-active [data-readonly-blocked="true"] {
      opacity: 0.48 !important;
      cursor: not-allowed !important;
      filter: grayscale(0.35) !important;
    }
    body.tenant-readonly-active input[type="file"] {
      opacity: 0.48 !important;
      pointer-events: none !important;
    }
    .tenant-readonly-toast {
      position: fixed;
      left: 50%;
      bottom: 24px;
      transform: translateX(-50%);
      z-index: 99999;
      background: #7c2d12;
      color: #fff7ed;
      border: 2px solid #d4af37;
      border-radius: 999px;
      padding: 10px 18px;
      font-weight: 900;
      box-shadow: 0 12px 30px rgba(0,0,0,0.25);
      direction: rtl;
      text-align: center;
    }
  `, []);

  useEffect(() => {
    if (!active) {
      document.body.classList.remove("tenant-readonly-active");
      document.querySelectorAll("[data-readonly-blocked]").forEach((el) => el.removeAttribute("data-readonly-blocked"));
      return;
    }

    document.body.classList.add("tenant-readonly-active");
    markBlockedControls();

    const showBlockedMessage = () => {
      setMessageVisible(true);
      window.setTimeout(() => setMessageVisible(false), 2200);
    };

    const onClickCapture = (event: MouseEvent) => {
      const actionEl = findActionElement(event.target);
      if (!actionEl) return;
      if (!isBlockedElement(actionEl)) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showBlockedMessage();
    };

    const onSubmitCapture = (event: SubmitEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      showBlockedMessage();
    };

    const onChangeCapture = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (String(target.type || "").toLowerCase() !== "file") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      target.value = "";
      showBlockedMessage();
    };

    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("submit", onSubmitCapture, true);
    document.addEventListener("change", onChangeCapture, true);

    const observer = new MutationObserver(() => markBlockedControls());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "title", "aria-label", "data-action"] });

    return () => {
      observer.disconnect();
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("submit", onSubmitCapture, true);
      document.removeEventListener("change", onChangeCapture, true);
      document.body.classList.remove("tenant-readonly-active");
    };
  }, [active]);

  return (
    <>
      {active ? <style>{readonlyStyle}</style> : null}
      {children}
      {active && messageVisible ? (
        <div className="tenant-readonly-toast">وضع مشاهدة فقط — لا يمكن تنفيذ الإضافة أو التعديل أو الحذف من حساب مشرف المحافظة.</div>
      ) : null}
    </>
  );
}
