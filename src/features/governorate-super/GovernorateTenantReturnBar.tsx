import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  getGovernorateReturnPath,
  resolveActualAdministrativeActor,
  resolveTenantAreaFromPath,
} from "../tenant-return/tenantReturnSecurity";
import "./GovernorateTenantReturnBar.css";

const GOVERNORATE_READONLY_KEYS = [
  "governorateSuperReadOnly",
  "viewAsReadOnly",
  "readOnly",
  "isReadOnlyView",
  "openedByGovernorateSuper",
  "governorateSuperViewTenantId",
  "viewAsTenantId",
  "governorateSuperViewExpiresAt",
  "governorateSuperReturnTo",
  "readOnlyReturnTo",
  "governorateSuperViewGovernorate",
  "viewAsRole",
  "viewAsScope",
  "selectedRole",
  "exam-manager:effectiveRole",
];

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

function isGovernorateReadonlyTenantView(pathname: string): boolean {
  if (!String(pathname || "").startsWith("/t/")) {
    return false;
  }

  const governorateFlag = isTruthy(
    readStorage("governorateSuperReadOnly")
  );

  const readOnlyFlag =
    isTruthy(readStorage("viewAsReadOnly")) ||
    isTruthy(readStorage("readOnly"));

  const tenantId =
    readStorage("governorateSuperViewTenantId") ||
    readStorage("viewAsTenantId");

  const expiresAt = Number(
    readStorage("governorateSuperViewExpiresAt") || "0"
  );

  const validExpiry =
    Number.isFinite(expiresAt) &&
    expiresAt > Date.now();

  return (
    governorateFlag &&
    readOnlyFlag &&
    Boolean(tenantId) &&
    validExpiry
  );
}

function hideCorruptedReadonlyBanner() {
  const nodes = Array.from(
    document.querySelectorAll<HTMLElement>(
      "body > div, body > header, body > section, body > aside, body > nav, body div"
    )
  );

  for (const node of nodes) {
    if (node.closest(".governorate-tenant-return-bar")) {
      continue;
    }

    if (
      node.getAttribute("data-governorate-return-bar") === "true"
    ) {
      continue;
    }

    const text = String(node.textContent || "").trim();
    if (!text) continue;

    const hasMojibake =
      text.includes("\ufffd") ||
      text.includes("\u00d8") ||
      text.includes("\u00d9") ||
      text.includes("\u00db") ||
      text.includes("\u00c3") ||
      text.includes("\u00c2") ||
      text.includes("\u0637\u00a7") ||
      text.includes("\u0638");

    const rect = node.getBoundingClientRect();
    const style = window.getComputedStyle(node);
    const zIndex = Number(style.zIndex || "0");

    const looksLikeTopBanner =
      (
        style.position === "fixed" ||
        style.position === "sticky" ||
        zIndex >= 9000
      ) &&
      rect.top <= 120 &&
      rect.height <= 110;

    if (hasMojibake && looksLikeTopBanner) {
      node.setAttribute(
        "data-hidden-corrupted-readonly-banner",
        "true"
      );

      node.style.setProperty(
        "display",
        "none",
        "important"
      );
    }
  }
}

function clearGovernorateReadonlyKeys() {
  for (const key of GOVERNORATE_READONLY_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {}

    try {
      sessionStorage.removeItem(key);
    } catch {}
  }

  window.dispatchEvent(new Event("yr-authz-refresh"));
  window.dispatchEvent(new Event("auth-changed"));
  window.dispatchEvent(new Event("effective-tenant-changed"));
  window.dispatchEvent(new Event("effective-role-changed"));
}

export default function GovernorateTenantReturnBar() {
  const auth = useAuth() as any;
  const location = useLocation();
  const navigate = useNavigate();

  const actualActor =
    resolveActualAdministrativeActor(auth);

  const tenantArea =
    resolveTenantAreaFromPath(location.pathname);

  const visible = useMemo(
    () =>
      actualActor === "governorate_super" &&
      isGovernorateReadonlyTenantView(location.pathname),
    [
      actualActor,
      location.pathname,
      location.search,
    ]
  );

  useEffect(() => {
    if (!visible) return;

    hideCorruptedReadonlyBanner();

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(
        hideCorruptedReadonlyBanner
      );
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    const interval = window.setInterval(
      hideCorruptedReadonlyBanner,
      1200
    );

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, [
    visible,
    location.pathname,
    location.search,
  ]);

  if (!visible) return null;

  const returnTo =
    getGovernorateReturnPath(tenantArea);

  const description =
    tenantArea === "diploma"
      ? "\u0623\u0646\u062a \u062f\u0627\u062e\u0644 \u0635\u0641\u062d\u0629 \u0645\u0631\u0643\u0632 \u0627\u0644\u062f\u0628\u0644\u0648\u0645 \u0628\u0635\u0644\u0627\u062d\u064a\u0627\u062a \u0645\u0634\u0631\u0641 \u0627\u0644\u0645\u062d\u0627\u0641\u0638\u0629 \u0644\u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0641\u0642\u0637."
      : "\u0623\u0646\u062a \u062f\u0627\u062e\u0644 \u0635\u0641\u062d\u0629 \u0627\u0644\u0645\u062f\u0631\u0633\u0629 \u0628\u0635\u0644\u0627\u062d\u064a\u0627\u062a \u0645\u0634\u0631\u0641 \u0627\u0644\u0645\u062d\u0627\u0641\u0638\u0629 \u0644\u0644\u0645\u062a\u0627\u0628\u0639\u0629 \u0641\u0642\u0637.";

  return (
    <div
      className="governorate-tenant-return-bar"
      data-governorate-return-bar="true"
      dir="rtl"
    >
      <div className="governorate-tenant-return-bar__text">
        <strong>
          {
            "\u0645\u0634\u0627\u0647\u062d\u0629 \u0641\u0642\u0637"
          }
        </strong>

        <span>{description}</span>
      </div>

      <button
        type="button"
        onClick={() => {
          clearGovernorateReadonlyKeys();
          navigate(returnTo, { replace: true });
        }}
      >
        {
          "\u0627\u0644\u0639\u0648\u062f\u0629 \u0625\u0644\u0649 \u0628\u0648\u0627\u0628\u0629 \u0645\u0634\u0631\u0641 \u0627\u0644\u0645\u062d\u0627\u0641\u0638\u0629"
        }
      </button>
    </div>
  );
}
