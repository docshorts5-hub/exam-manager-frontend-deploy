import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { MINISTRY_SCOPE } from "../../constants/directorates";
import {
  resolveActualAdministrativeActor,
  sanitizeMinistryReturnPath,
} from "../../features/tenant-return/tenantReturnSecurity";
import "./MinistryTenantReturnBar.css";

const t = {
  title: "\u0645\u0634\u0631\u0641 \u0627\u0644\u0648\u0632\u0627\u0631\u0629",
  readonly:
    "\u0648\u0636\u0639 \u0627\u0644\u0645\u0634\u0627\u0647\u062f\u0629 \u0641\u0642\u0637",
  desc:
    "\u0647\u0630\u0627 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0646 \u062d\u0633\u0627\u0628 \u0645\u0634\u0631\u0641 \u0627\u0644\u0648\u0632\u0627\u0631\u0629\u060c \u0644\u0627 \u064a\u0645\u0643\u0646 \u0627\u0644\u0625\u0636\u0627\u0641\u0629 \u0623\u0648 \u0627\u0644\u062a\u0639\u062f\u064a\u0644 \u0623\u0648 \u0627\u0644\u062d\u0630\u0641.",
  back:
    "\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0635\u0641\u062d\u0629 \u0645\u0634\u0631\u0641 \u0627\u0644\u0648\u0632\u0627\u0631\u0629",
};

function readStorage(key: string): string {
  try {
    return String(
      sessionStorage.getItem(key) ||
        localStorage.getItem(key) ||
        ""
    ).trim();
  } catch {
    return "";
  }
}

function isTruthy(value: string): boolean {
  return ["1", "true", "yes", "on"].includes(
    String(value || "").trim().toLowerCase()
  );
}

function detectMinistryTenantView(): boolean {
  const params = new URLSearchParams(window.location.search);

  const urlFlag = params.get("fromMinistrySuper") === "1";

  const scopeFlag = [
    "viewAsScope",
    "effectiveScope",
    "scope",
  ]
    .map(readStorage)
    .some(
      (value) =>
        String(value || "").trim() === MINISTRY_SCOPE
    );

  const hasMinistryReturnContext = Boolean(
    readStorage("ministryReturnTo")
  );

  const readOnlyFlag = [
    params.get("readOnly") || "",
    readStorage("readOnly"),
    readStorage("viewAsReadOnly"),
    readStorage("governorateSuperReadOnly"),
  ].some(isTruthy);

  return (
    readOnlyFlag &&
    (urlFlag || scopeFlag || hasMinistryReturnContext)
  );
}

function getReturnTo(): string {
  return sanitizeMinistryReturnPath(
    readStorage("ministryReturnTo")
  );
}

export default function MinistryTenantReturnBar() {
  const auth = useAuth() as any;
  const location = useLocation();

  const actualActor =
    resolveActualAdministrativeActor(auth);

  const [active, setActive] = useState(false);

  useEffect(() => {
    const update = () => {
      const nextActive =
        actualActor === "ministry_super" &&
        detectMinistryTenantView();

      setActive(nextActive);

      document.body.classList.toggle(
        "ministry-tenant-readonly-active",
        nextActive
      );
    };

    update();

    window.addEventListener("storage", update);
    window.addEventListener("yr-authz-refresh", update);

    return () => {
      document.body.classList.remove(
        "ministry-tenant-readonly-active"
      );
      window.removeEventListener("storage", update);
      window.removeEventListener("yr-authz-refresh", update);
    };
  }, [
    actualActor,
    location.pathname,
    location.search,
  ]);

  const returnTo = useMemo(
    () => getReturnTo(),
    [active, location.pathname, location.search]
  );

  if (!active) return null;

  const goBack = () => {
    window.location.assign(returnTo);
  };

  return (
    <div className="ministry-tenant-return-bar" dir="rtl">
      <div className="ministry-tenant-return-text">
        <strong>{t.title}</strong>
        <span>{t.readonly}</span>
        <small>{t.desc}</small>
      </div>

      <button type="button" onClick={goBack}>
        {t.back}
      </button>
    </div>
  );
}
