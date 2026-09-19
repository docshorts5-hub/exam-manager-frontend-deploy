import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { callFn } from "../services/functionsClient";

const OWNER_EMAIL = "3asal2030@gmail.com";

type TargetAccount = {
  uid: string;
  email: string;
  displayName: string;
  disabled: boolean;
  role: string;
  tenantId: string;
  governorate: string;
  tenantKind: string;
  providerIds: string[];
  factorCount: number;
  totpFactorCount: number;
  otherFactorCount: number;
  totpEnrolled: boolean;
};

type InspectResponse = {
  ok: boolean;
  target: TargetAccount;
};

type ResetResponse = {
  ok: boolean;
  requestId: string;
  status: "SUCCESS" | "PARTIAL_SUCCESS";
  targetEmail: string;
  removedTotpFactors: number;
  preservedOtherFactors: number;
  refreshTokensRevoked: boolean;
  warningCode?: string;
};

type AuditItem = {
  id: string;
  status: string;
  actorEmail: string;
  targetEmail: string;
  targetRole: string;
  targetGovernorate: string;
  reason: string;
  createdAt: string;
  completedAt: string;
};

type AuditResponse = {
  ok: boolean;
  items: AuditItem[];
};

const inspectAccount =
  callFn<{ email: string }, InspectResponse>(
    "totpAdminInspectUser"
  );

const resetAccount =
  callFn<
    {
      requestId: string;
      email: string;
      confirmTargetEmail: string;
      reason: string;
      confirmSelfReset: boolean;
    },
    ResetResponse
  >("totpAdminResetUser");

const loadAuditRecords =
  callFn<{ limit: number }, AuditResponse>(
    "totpAdminListResetAudit"
  );

/* TOTP_MANAGED_USER_PICKER_V1 */

type ManagedUserOption = {
  email: string;
  name: string;
  role: string;
  governorate: string;
  tenantId: string;
  tenantName: string;
  enabled: boolean;
};

const listManagedUsers =
  callFn<Record<string, never>, unknown>(
    "adminListManagedUsers"
  );

function normalizeManagedUsersResponse(
  response: unknown
): ManagedUserOption[] {
  const root = response as any;

  const candidates =
    Array.isArray(root)
      ? root
      : Array.isArray(root?.users)
        ? root.users
        : Array.isArray(root?.items)
          ? root.items
          : Array.isArray(root?.rows)
            ? root.rows
            : Array.isArray(root?.data)
              ? root.data
              : Array.isArray(root?.data?.users)
                ? root.data.users
                : Array.isArray(root?.data?.items)
                  ? root.data.items
                  : [];

  const unique =
    new Map<string, ManagedUserOption>();

  for (const raw of candidates) {
    const email =
      String(
        raw?.email ??
        raw?.userEmail ??
        raw?.id ??
        ""
      )
        .trim()
        .toLowerCase();

    if (!email || !email.includes("@")) {
      continue;
    }

    const row: ManagedUserOption = {
      email,
      name: String(
        raw?.name ??
        raw?.displayName ??
        raw?.fullName ??
        raw?.userName ??
        ""
      ).trim(),

      role: String(
        raw?.role ??
        raw?.roleId ??
        ""
      ).trim(),

      governorate: String(
        raw?.governorate ??
        raw?.tenantGovernorate ??
        raw?.region ??
        ""
      ).trim(),

      tenantId: String(
        raw?.tenantId ??
        raw?.tenant ??
        ""
      ).trim(),

      tenantName: String(
        raw?.tenantName ??
        raw?.organizationName ??
        raw?.schoolName ??
        raw?.centerName ??
        raw?.organization ??
        ""
      ).trim(),

      enabled: raw?.enabled !== false,
    };

    if (!unique.has(email)) {
      unique.set(email, row);
    }
  }

  return Array.from(unique.values()).sort(
    (a, b) =>
      (a.name || a.email).localeCompare(
        b.name || b.email,
        "ar"
      )
  );
}

const roleLabels: Record<string, string> = {
  super_admin: "مالك المنصة",
  ministry_super: "مشرف الوزارة",
  super: "مشرف المحافظة",
  governorate_super: "مشرف المحافظة",
  tenant_admin: "مدير المدرسة",
  admin: "مدير المدرسة",
  exam_super: "مشرف امتحانات الدبلوم",
};

const errorMessages: Record<string, string> = {
  AUTH_REQUIRED: "يجب تسجيل الدخول أولًا.",
  USER_DISABLED_OR_NOT_ALLOWED: "الحساب الحالي غير مفعل أو غير مصرح له.",
  TOTP_RESET_ADMIN_ROLE_REQUIRED: "لا تملك صلاحية إدارة إعادة تهيئة TOTP.",
  SECOND_FACTOR_ADMIN_SESSION_REQUIRED:
    "سجّل الخروج ثم ادخل مجددًا باستخدام رمز TOTP.",
  RECENT_MFA_SIGN_IN_REQUIRED:
    "انتهت مدة الجلسة الأمنية. سجّل الدخول مجددًا باستخدام TOTP.",
  ACTOR_TOTP_ENROLLMENT_REQUIRED:
    "يجب تسجيل TOTP في حساب المسؤول أولًا.",
  INVALID_EMAIL: "أدخل بريدًا إلكترونيًا صحيحًا.",
  INVALID_REQUEST_ID: "تعذر إنشاء معرف أمني صالح للعملية.",
  TOTP_RESET_ALREADY_IN_PROGRESS:
    "توجد عملية إعادة تهيئة أخرى قيد التنفيذ لهذا الحساب.",
  REQUEST_ID_COLLISION:
    "تعارض معرف العملية مع سجل أمني آخر. افحص الحساب مجددًا.",
  REQUEST_ID_PREVIOUSLY_FAILED:
    "فشلت المحاولة السابقة بهذا المعرف. افحص الحساب مجددًا قبل إعادة التنفيذ.",
  AUTH_USER_NOT_FOUND: "لم يتم العثور على الحساب في Firebase Authentication.",
  MINISTRY_CAN_RESET_GOVERNORATE_SUPERS_ONLY:
    "مشرف الوزارة يستطيع إعادة تهيئة مشرفي المحافظات فقط.",
  GOVERNORATE_CAN_RESET_SCHOOL_AND_DIPLOMA_ADMINS_ONLY:
    "مشرف المحافظة يستطيع إعادة تهيئة حسابات المدارس والدبلوم فقط.",
  CROSS_GOVERNORATE_TOTP_RESET_DENIED:
    "لا يمكن إعادة تهيئة حساب تابع لمحافظة أخرى.",
  TARGET_TENANT_LINK_REQUIRED:
    "الحساب غير مربوط بمدرسة أو مركز دبلوم بصورة صحيحة.",
  GOVERNORATE_SUPER_SELF_RESET_DENIED:
    "مشرف المحافظة لا يستطيع إعادة تهيئة حسابه بنفسه.",
  OWNER_SELF_RESET_CONFIRMATION_REQUIRED:
    "إعادة تهيئة حساب المالك تتطلب تأكيدًا إضافيًا.",
  TARGET_EMAIL_CONFIRMATION_MISMATCH:
    "البريد المكتوب للتأكيد لا يطابق الحساب المستهدف.",
  RESET_REASON_MUST_BE_10_TO_500_CHARACTERS:
    "يجب كتابة سبب واضح من 10 إلى 500 حرف.",
  TOTP_NOT_ENROLLED:
    "الحساب لا يحتوي على عامل TOTP مسجل.",
  MFA_FACTOR_PRESERVATION_VALIDATION_FAILED:
    "أوقفت العملية لحماية عوامل المصادقة الأخرى.",
};

function createResetRequestId() {
  const nativeId =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : "";

  if (nativeId) return nativeId;

  return [
    "totp",
    Date.now().toString(36),
    Math.random().toString(36).slice(2),
    Math.random().toString(36).slice(2),
  ].join("_");
}

function normalizeRole(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function displayError(error: unknown) {
  const candidate = error as {
    code?: unknown;
    message?: unknown;
  };

  const raw =
    `${String(candidate.code ?? "")} ${String(candidate.message ?? "")}`;

  const normalizedRaw = raw.toLowerCase();

  if (
    normalizedRaw.includes("cloud_runtime_required") ||
    normalizedRaw.includes("local_function_not_implemented")
  ) {
    return "وظائف إدارة TOTP تحتاج Cloud Functions مفعلة أو Functions Emulator يعمل. لا يوجد بديل محلي لهذه العملية الأمنية."
  }

  if (
    normalizedRaw.includes("functions/not-found") ||
    normalizedRaw.includes("function not found") ||
    normalizedRaw.includes("404")
  ) {
    return "وظائف إدارة TOTP غير موجودة في البيئة الحالية. شغّل Functions Emulator محليًا أو انشر الوظائف المعتمدة قبل استخدام الصفحة."
  }

  if (
    normalizedRaw.includes("functions/unavailable") ||
    normalizedRaw.includes("network-request-failed") ||
    normalizedRaw.includes("failed to fetch") ||
    normalizedRaw.includes("connection refused")
  ) {
    return "تعذر الاتصال بخدمة Cloud Functions. تحقق من تشغيل Functions Emulator أو توفر الوظائف السحابية ثم أعد المحاولة."
  }

  const knownCode =
    Object.keys(errorMessages).find((code) =>
      raw.includes(code)
    );

  return knownCode
    ? errorMessages[knownCode]
    : "لم تصل استجابة صحيحة من خدمة إدارة TOTP. تحقق من تشغيل Cloud Functions ومن صلاحية الجلسة ثم أعد المحاولة.";
}

function formatDate(value: string) {
  if (!value) return "—";

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleString("ar-OM");
}

const pageCss = `
  .totp-page {
    min-height: 100vh;
    padding: 28px;
    direction: rtl;
    background: linear-gradient(180deg, #f7faf9, #edf2f0);
    color: #172033;
    font-family: Cairo, system-ui, sans-serif;
  }

  .totp-shell {
    width: min(1180px, 100%);
    margin: 0 auto;
  }

  .totp-header,
  .totp-card,
  .totp-alert {
    border: 1px solid #d7dfdc;
    border-radius: 20px;
    background: #ffffff;
    box-shadow: 0 14px 38px rgba(15, 23, 42, 0.07);
  }

  .totp-header {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    padding: 25px;
    border-top: 5px solid #14784c;
  }

  .totp-header h1 {
    margin: 3px 0 5px;
    color: #0b5132;
  }

  .totp-header p {
    margin: 0;
    color: #5d697a;
    line-height: 1.8;
  }

  .totp-button {
    border: 0;
    border-radius: 12px;
    padding: 11px 18px;
    background: #14784c;
    color: white;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  .totp-button:disabled {
    cursor: not-allowed;
    opacity: 0.48;
  }

  .totp-back {
    align-self: flex-start;
    background: #344054;
  }

  .totp-alert {
    margin-top: 16px;
    padding: 14px 18px;
    line-height: 1.8;
  }

  .totp-error {
    border-color: #db7676;
    background: #fff1f1;
    color: #8b1f1f;
  }

  .totp-success {
    border-color: #63aa82;
    background: #edf9f1;
    color: #17633b;
  }

  .totp-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 18px;
    margin-top: 18px;
  }

  .totp-card {
    padding: 22px;
  }

  .totp-card h2 {
    margin-top: 0;
    color: #243148;
  }

  .totp-form {
    display: grid;
    gap: 10px;
  }

  .totp-form label {
    font-weight: 800;
  }

  .totp-form input:not([type="checkbox"]),
  .totp-form textarea {
    width: 100%;
    box-sizing: border-box;
    border: 1px solid #8eae9f;
    border-radius: 11px;
    padding: 12px 14px;
    background: #edf5f1;
    color: #172033;
    caret-color: #0b6942;
    font: inherit;
    font-weight: 700;
    outline: none;
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease,
      background-color 160ms ease;
  }

  .totp-form input:not([type="checkbox"])::placeholder,
  .totp-form textarea::placeholder {
    color: #77877f;
    opacity: 1;
    font-weight: 600;
  }

  .totp-form input:not([type="checkbox"]):focus-visible,
  .totp-form textarea:focus-visible {
    border-color: #0f7a4b;
    background: #f6fbf8;
    box-shadow:
      0 0 0 3px rgba(15, 122, 75, 0.16),
      0 0 0 5px rgba(201, 155, 36, 0.10);
  }

  .totp-form input:not([type="checkbox"]):disabled,
  .totp-form textarea:disabled {
    background: #e2e8e5;
    color: #66736d;
    cursor: not-allowed;
    opacity: 0.82;
  }

  .totp-form input:-webkit-autofill,
  .totp-form input:-webkit-autofill:hover,
  .totp-form input:-webkit-autofill:focus {
    -webkit-text-fill-color: #172033;
    box-shadow: 0 0 0 1000px #edf5f1 inset;
    transition: background-color 9999s ease-out 0s;
  }

  .totp-form input[type="checkbox"] {
    width: auto;
    accent-color: #14784c;
  }

  .totp-email-input {
    direction: ltr;
    text-align: left;
    letter-spacing: 0.01em;
    color: #0b4aa2 !important;
    -webkit-text-fill-color: #0b4aa2 !important;
    font-weight: 800 !important;
  }

  .totp-email-input::selection {
    background: #dbe8ff;
    color: #0b4aa2;
    -webkit-text-fill-color: #0b4aa2;
  }

  .totp-email-input::-moz-selection {
    background: #dbe8ff;
    color: #0b4aa2;
  }

  .totp-form input.totp-email-input:-webkit-autofill,
  .totp-form input.totp-email-input:-webkit-autofill:hover,
  .totp-form input.totp-email-input:-webkit-autofill:focus {
    -webkit-text-fill-color: #0b4aa2 !important;
    font-weight: 800 !important;
  }

  .totp-field-help {
    margin: -2px 2px 3px;
    color: #5f7068;
    font-size: 13px;
    line-height: 1.7;
  }

  .totp-empty-state {
    margin-top: 14px;
    padding: 13px 15px;
    border: 1px dashed #9eb8ac;
    border-radius: 12px;
    background: #f1f6f3;
    color: #52645b;
    line-height: 1.8;
  }

  .totp-loading-state {
    border-style: solid;
    border-color: #7fae98;
    color: #0b6942;
    font-weight: 800;
  }

  .totp-button:focus-visible {
    outline: 3px solid rgba(201, 155, 36, 0.38);
    outline-offset: 3px;
  }

  .totp-details {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
    margin-top: 18px;
  }

  .totp-detail {
    padding: 11px;
    border-radius: 11px;
    background: #f5f7f6;
  }

  .totp-detail span {
    display: block;
    color: #667085;
    font-size: 12px;
  }

  .totp-detail strong {
    overflow-wrap: anywhere;
  }

  .totp-danger {
    background: #a92535;
  }

  .totp-audit {
    margin-top: 18px;
  }

  .totp-table-wrap {
    overflow-x: auto;
  }

  .totp-table {
    width: 100%;
    min-width: 820px;
    border-collapse: collapse;
  }

  .totp-table th,
  .totp-table td {
    padding: 11px;
    border-bottom: 1px solid #e4e9e7;
    text-align: right;
  }

  .totp-table th {
    background: #f3f6f5;
  }

  @media (max-width: 820px) {
    .totp-page {
      padding: 14px;
    }

    .totp-header,
    .totp-grid {
      grid-template-columns: 1fr;
      flex-direction: column;
    }

    .totp-grid,
    .totp-details {
      grid-template-columns: 1fr;
    }
  }

  /* TOTP_SECURITY_DESIGN_V1 */

  .totp-page {
    min-height: 100vh;
    padding: 30px 24px 60px;
    background:
      linear-gradient(
        135deg,
        #fff2d7 0%,
        #f8f7ee 42%,
        #e4f1ff 100%
      );
    color: #172033;
  }

  .totp-shell {
    width: min(1240px, 100%);
    margin: 0 auto;
  }

  .totp-header {
    position: relative;
    padding: 20px 8px 24px;
    background: transparent;
    border: 0;
    border-radius: 0;
    border-top: 0;
    box-shadow: none;
  }

  .totp-header::after {
    content: "";
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 1px;
    background:
      linear-gradient(
        90deg,
        transparent,
        rgba(20,120,76,.32),
        transparent
      );
  }

  .totp-header h1 {
    margin: 3px 0 7px;
    color: #12683b;
    font-size: clamp(27px, 3vw, 38px);
    font-weight: 1000;
    letter-spacing: -.02em;
  }

  .totp-header p {
    max-width: 760px;
    margin: 0;
    color: #64748b;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.9;
  }

  .totp-grid {
    gap: 20px;
    margin-top: 22px;
  }

  .totp-card {
    position: relative;
    overflow: hidden;
    padding: 24px;
    border: 1px solid rgba(20,120,76,.19);
    border-radius: 22px;
    background: rgba(255,255,255,.94);
    box-shadow:
      0 12px 30px rgba(15,23,42,.07),
      inset 0 1px 0 rgba(255,255,255,.75);
  }

  .totp-card::before {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    height: 4px;
    background:
      linear-gradient(
        90deg,
        #14784c,
        #20a566,
        #14784c
      );
  }

  .totp-card h2 {
    margin: 3px 0 18px;
    color: #17345f;
    font-size: 21px;
    font-weight: 1000;
  }

  .totp-form {
    gap: 12px;
  }

  .totp-form label {
    color: #243148;
    font-weight: 900;
  }

  .totp-form input:not([type="checkbox"]),
  .totp-form textarea {
    min-height: 48px;
    border: 1px solid #cad8d1;
    border-radius: 13px;
    padding: 12px 14px;
    background: #ffffff;
    color: #172033;
    font-family: inherit;
    font-size: 15px;
    font-weight: 750;
    box-shadow:
      inset 0 1px 2px rgba(15,23,42,.025);
  }

  .totp-form textarea {
    min-height: 118px;
    resize: vertical;
    line-height: 1.8;
  }

  .totp-form input:not([type="checkbox"]):focus-visible,
  .totp-form textarea:focus-visible {
    outline: none;
    border-color: #168a4b;
    background: #ffffff;
    box-shadow:
      0 0 0 4px rgba(22,138,75,.12);
  }

  .totp-email-input {
    color: #174d92 !important;
    -webkit-text-fill-color: #174d92 !important;
    font-weight: 900 !important;
  }

  .totp-field-help {
    color: #64748b;
    font-size: 13px;
    font-weight: 700;
  }

  .totp-details {
    gap: 10px;
    margin-top: 18px;
  }

  .totp-detail {
    padding: 13px 14px;
    border: 1px solid #e1e8e4;
    border-radius: 14px;
    background:
      linear-gradient(
        180deg,
        #ffffff,
        #f7faf8
      );
  }

  .totp-detail span {
    margin-bottom: 4px;
    color: #718096;
    font-size: 12px;
    font-weight: 800;
  }

  .totp-detail strong {
    color: #1e293b;
    font-weight: 1000;
  }

  .totp-button {
    min-height: 44px;
    border: 1px solid #087443;
    border-bottom: 3px solid #05643a;
    border-radius: 12px;
    padding: 10px 20px;
    background:
      linear-gradient(
        180deg,
        #1eaa63,
        #087443
      );
    color: #ffffff;
    font: inherit;
    font-weight: 1000;
    cursor: pointer;
    box-shadow:
      0 6px 14px rgba(8,116,67,.16);
    transition:
      transform .16s ease,
      box-shadow .16s ease;
  }

  .totp-button:not(:disabled):hover {
    transform: translateY(-2px);
    box-shadow:
      0 10px 20px rgba(8,116,67,.23);
  }

  .totp-button:disabled {
    cursor: not-allowed;
    opacity: .48;
    transform: none;
    box-shadow: none;
  }

  .totp-back {
    align-self: flex-start;
    border-color: #b6c6d9;
    border-bottom-color: #9caec2;
    background:
      linear-gradient(
        180deg,
        #ffffff,
        #edf3f8
      );
    color: #17345f;
    box-shadow:
      0 5px 13px rgba(23,52,95,.08);
  }

  .totp-danger {
    border-color: #b32638;
    border-bottom-color: #8f1e2d;
    background:
      linear-gradient(
        180deg,
        #d33c50,
        #a92535
      );
    box-shadow:
      0 7px 15px rgba(169,37,53,.18);
  }

  .totp-alert {
    margin-top: 18px;
    padding: 15px 18px;
    border-radius: 15px;
    box-shadow: none;
    font-weight: 750;
  }

  .totp-error {
    border-color: #efb0b0;
    background: #fff5f5;
    color: #9b2432;
  }

  .totp-success {
    border-color: #8ad0a7;
    background: #effbf4;
    color: #14643c;
  }

  .totp-empty-state {
    padding: 15px 17px;
    border: 1px dashed #9fb9ad;
    border-radius: 14px;
    background: rgba(244,250,247,.9);
    color: #52645b;
  }

  .totp-loading-state {
    border-style: solid;
    border-color: #81b59c;
    background: #f3fbf7;
    color: #0c6842;
  }

  .totp-audit {
    margin-top: 22px;
  }

  .totp-audit table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0 10px;
  }

  .totp-audit thead th {
    padding: 13px 14px;
    background:
      linear-gradient(
        180deg,
        #159557,
        #0f7a46
      );
    color: #ffffff;
    font-weight: 1000;
    text-align: center;
    border-bottom: 3px solid #086239;
  }

  .totp-audit thead th:first-child {
    border-radius: 0 13px 13px 0;
  }

  .totp-audit thead th:last-child {
    border-radius: 13px 0 0 13px;
  }

  .totp-audit tbody tr {
    filter:
      drop-shadow(
        0 5px 9px rgba(15,23,42,.05)
      );
  }

  .totp-audit tbody td {
    padding: 13px 14px;
    background: rgba(255,255,255,.95);
    border-top: 1px solid #e5ebe8;
    border-bottom: 1px solid #e5ebe8;
    vertical-align: middle;
  }

  .totp-audit tbody tr:hover td {
    background: #f4fbf7;
  }

  .totp-audit tbody td:first-child {
    border-right: 1px solid #e5ebe8;
    border-radius: 0 14px 14px 0;
  }

  .totp-audit tbody td:last-child {
    border-left: 1px solid #e5ebe8;
    border-radius: 14px 0 0 14px;
  }

  @media (max-width: 820px) {
    .totp-page {
      padding: 20px 12px 45px;
    }

    .totp-header {
      flex-direction: column;
      align-items: stretch;
    }

    .totp-grid,
    .totp-details {
      grid-template-columns: 1fr;
    }

    .totp-card {
      padding: 19px;
    }

    .totp-audit {
      overflow-x: auto;
    }

    .totp-audit table {
      min-width: 820px;
    }
  }

  /* TOTP_AUDIT_DASHBOARD_STYLES_V1 */

  .totp-audit {
    position: relative;
    overflow: hidden;
    margin-top: 24px;
  }

  .totp-audit::before {
    content: "";
    position: absolute;
    inset: 0 0 auto 0;
    height: 5px;
    background:
      linear-gradient(
        90deg,
        #0c6f43,
        #18a362,
        #0c6f43
      );
  }

  .totp-audit__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 22px;
    margin-bottom: 20px;
  }

  .totp-audit__heading {
    min-width: 0;
  }

  .totp-audit__eyebrow {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    margin-bottom: 7px;
    padding: 4px 11px;
    border: 1px solid #a9d9bf;
    border-radius: 999px;
    background: #edf9f2;
    color: #0c6a40;
    font-size: 12px;
    font-weight: 1000;
  }

  .totp-audit__heading h2 {
    margin: 0;
    color: #103b2a;
    font-size: clamp(21px, 2.2vw, 28px);
    font-weight: 1000;
  }

  .totp-audit__heading p {
    max-width: 780px;
    margin: 7px 0 0;
    color: #63726b;
    line-height: 1.8;
    font-size: 13px;
    font-weight: 700;
  }

  .totp-audit__reload {
    flex: 0 0 auto;
    min-width: 145px;
    width: auto;
  }

  .totp-audit__stats {
    display: grid;
    grid-template-columns:
      repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 17px;
  }

  .totp-audit-stat {
    position: relative;
    display: grid;
    gap: 5px;
    min-height: 112px;
    padding: 15px 16px;
    overflow: hidden;
    border: 1px solid #dce8e2;
    border-radius: 16px;
    background:
      linear-gradient(
        145deg,
        #ffffff,
        #f8fbf9
      );
    box-shadow:
      0 8px 20px rgba(15,23,42,.045);
  }

  .totp-audit-stat::after {
    content: "";
    position: absolute;
    top: 0;
    right: 0;
    width: 5px;
    height: 100%;
    background: #68817a;
  }

  .totp-audit-stat.is-success::after {
    background: #159557;
  }

  .totp-audit-stat.is-partial::after {
    background: #d48b1c;
  }

  .totp-audit-stat.is-other::after {
    background: #60758e;
  }

  .totp-audit-stat span {
    color: #53665d;
    font-size: 12px;
    font-weight: 900;
  }

  .totp-audit-stat strong {
    color: #17251f;
    font-size: 28px;
    line-height: 1;
    font-weight: 1000;
  }

  .totp-audit-stat small {
    color: #7b8a83;
    font-size: 11px;
    font-weight: 750;
  }

  .totp-audit__filters {
    display: grid;
    grid-template-columns:
      minmax(0, 1fr) minmax(190px, 260px);
    gap: 12px;
    margin: 0 0 14px;
    padding: 14px;
    border: 1px solid #dde8e3;
    border-radius: 16px;
    background:
      linear-gradient(
        135deg,
        #f9fcfa,
        #f5f9ff
      );
  }

  .totp-audit-filter {
    display: grid;
    gap: 7px;
  }

  .totp-audit-filter > span {
    color: #365147;
    font-size: 12px;
    font-weight: 950;
  }

  .totp-audit-filter input,
  .totp-audit-filter select {
    width: 100%;
    min-height: 45px;
    padding: 9px 12px;
    border: 1px solid #cfded6;
    border-radius: 11px;
    outline: none;
    background: #ffffff;
    color: #172033;
    font: inherit;
    font-weight: 750;
    transition:
      border-color .18s ease,
      box-shadow .18s ease;
  }

  .totp-audit-filter input:focus,
  .totp-audit-filter select:focus {
    border-color: #248a5b;
    box-shadow:
      0 0 0 3px rgba(36,138,91,.12);
  }

  .totp-audit-filter input:disabled,
  .totp-audit-filter select:disabled {
    cursor: not-allowed;
    opacity: .58;
  }

  .totp-audit__summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 0 0 13px;
    padding: 9px 12px;
    border-radius: 11px;
    background: #f2f7f4;
    color: #52655c;
    font-size: 12px;
    font-weight: 750;
  }

  .totp-audit__summary strong {
    color: #0d6740;
    font-weight: 1000;
  }

  .totp-audit__clear {
    border: 0;
    padding: 5px 9px;
    border-radius: 8px;
    background: transparent;
    color: #176c47;
    cursor: pointer;
    font: inherit;
    font-size: 12px;
    font-weight: 950;
  }

  .totp-audit__clear:hover {
    background: #e4f3ea;
  }

  .totp-audit__clear:disabled {
    cursor: not-allowed;
    opacity: .55;
  }

  .totp-audit .totp-table-wrap {
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .totp-audit .totp-table {
    min-width: 1050px;
  }

  .totp-audit-status {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 92px;
    min-height: 30px;
    padding: 5px 10px;
    border: 1px solid transparent;
    border-radius: 999px;
    white-space: nowrap;
    font-size: 11px;
    font-weight: 1000;
  }

  .totp-audit-status.is-success {
    border-color: #91d1aa;
    background: #eaf8f0;
    color: #11693c;
  }

  .totp-audit-status.is-partial {
    border-color: #ebc47b;
    background: #fff8e8;
    color: #875b12;
  }

  .totp-audit-status.is-failed {
    border-color: #efafb8;
    background: #fff1f2;
    color: #a32638;
  }

  .totp-audit-status.is-denied {
    border-color: #e7b38d;
    background: #fff5ed;
    color: #984d19;
  }

  .totp-audit-status.is-other {
    border-color: #ccd6df;
    background: #f3f6f8;
    color: #4c6171;
  }

  .totp-audit-email {
    display: inline-block;
    max-width: 220px;
    overflow-wrap: anywhere;
    direction: ltr;
    text-align: left;
    color: #263d50;
    font-size: 12px;
    font-weight: 850;
  }

  .totp-audit-role {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 28px;
    padding: 4px 9px;
    border-radius: 999px;
    background: #eef5ff;
    color: #245e9a;
    font-size: 11px;
    font-weight: 950;
    white-space: nowrap;
  }

  .totp-audit-reason {
    display: -webkit-box;
    max-width: 280px;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;
    color: #475850;
    line-height: 1.65;
    font-size: 12px;
    font-weight: 700;
  }

  .totp-audit-date {
    display: inline-block;
    min-width: 130px;
    color: #495c53;
    direction: rtl;
    font-size: 12px;
    font-weight: 800;
    white-space: nowrap;
  }

  .totp-audit__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px dashed #cfdcd5;
    color: #728078;
    font-size: 11px;
    font-weight: 700;
  }

  .totp-audit__footer strong {
    color: #3b5749;
    direction: ltr;
  }

  @media (max-width: 900px) {
    .totp-audit__stats {
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
    }

    .totp-audit__filters {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 620px) {
    .totp-audit__header,
    .totp-audit__summary,
    .totp-audit__footer {
      align-items: stretch;
      flex-direction: column;
    }

    .totp-audit__reload {
      width: 100%;
    }

    .totp-audit__stats {
      grid-template-columns: 1fr;
    }
  }
  /* TOTP_MINISTRY_BRANDING_STYLES */

  .totp-ministry-identity {
    display: flex;
    align-items: center;
    gap: 16px;
    align-self: flex-start;
    direction: rtl;
    text-align: right;
    margin-bottom: 8px;
  }

  .totp-ministry-logo {
    width: 92px;
    height: 92px;
    object-fit: contain;
    display: block;
    flex: 0 0 auto;
  }

  .totp-ministry-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
    line-height: 1.45;
  }

  .totp-ministry-text strong {
    color: #12683b;
    font-size: 22px;
    font-weight: 1000;
  }

  .totp-ministry-text span {
    color: #12683b;
    font-size: 22px;
    font-weight: 1000;
  }

  .totp-ministry-text small {
    margin-top: 2px;
    color: #334155;
    font-size: 13px;
    font-weight: 850;
  }

  @media (max-width: 820px) {
    .totp-ministry-identity {
      align-self: center;
      justify-content: center;
    }

    .totp-ministry-logo {
      width: 76px;
      height: 76px;
    }

    .totp-ministry-text strong,
    .totp-ministry-text span {
      font-size: 19px;
    }
  }

  /* TOTP_SECURITY_RETURN_V1 */
  .totp-back {
    min-width: 205px !important;
    white-space: nowrap;
    border: 1px solid #b7c8d9 !important;
    border-bottom: 3px solid #91a8bd !important;
    background:
      linear-gradient(
        180deg,
        #ffffff 0%,
        #edf4f8 100%
      ) !important;
    color: #17345f !important;
    box-shadow:
      0 6px 15px rgba(23,52,95,.10) !important;
  }

  .totp-back:hover {
    transform: translateY(-2px);
    box-shadow:
      0 9px 19px rgba(23,52,95,.15) !important;
  }

  /* TOTP_MANAGED_USER_PICKER_STYLES */

  .totp-user-picker {
    display: grid;
    gap: 9px;
    margin-bottom: 6px;
    padding: 15px;
    border: 1px solid rgba(20,120,76,.20);
    border-radius: 16px;
    background:
      linear-gradient(
        135deg,
        rgba(239,251,244,.96),
        rgba(247,250,255,.96)
      );
  }

  .totp-user-picker__title {
    color: #12683b;
    font-size: 15px;
    font-weight: 1000;
  }

  .totp-user-picker input,
  .totp-user-picker select {
    width: 100%;
    min-height: 46px;
    box-sizing: border-box;
    border: 1px solid #c7d8d0;
    border-radius: 12px;
    padding: 10px 13px;
    background: #ffffff;
    color: #172033;
    font-family: inherit;
    font-size: 14px;
    font-weight: 800;
  }

  .totp-user-picker input:focus-visible,
  .totp-user-picker select:focus-visible {
    outline: none;
    border-color: #168a4b;
    box-shadow:
      0 0 0 4px rgba(22,138,75,.10);
  }

  .totp-user-picker select {
    cursor: pointer;
  }

  .totp-user-picker select:disabled,
  .totp-user-picker input:disabled {
    cursor: not-allowed;
    opacity: .60;
  }

  .totp-user-picker__status {
    color: #64748b;
    font-size: 12px;
    font-weight: 750;
    line-height: 1.7;
  }

  /* TOTP_SELECT_READABILITY_V1 */

  .totp-user-picker select {
    background: #ffffff !important;
    color: #172033 !important;
    -webkit-text-fill-color: #172033 !important;
    font-weight: 850 !important;
  }

  .totp-user-picker select option {
    background: #ffffff !important;
    color: #172033 !important;
    -webkit-text-fill-color: #172033 !important;
    font-family: inherit !important;
    font-size: 14px !important;
    font-weight: 800 !important;
  }

  .totp-user-picker select option:checked {
    background: #2567cc;
    color: #ffffff !important;
    -webkit-text-fill-color: #ffffff !important;
  }

  /* TOTP_SELECTED_USER_CARD_STYLES */

  .totp-selected-user {
    display: grid;
    gap: 14px;
    margin-top: 5px;
    padding: 16px;
    border: 1px solid rgba(23,52,95,.16);
    border-radius: 17px;
    background:
      linear-gradient(
        135deg,
        #f8fbff 0%,
        #f3faf6 100%
      );
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,.9);
  }

  .totp-selected-user__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .totp-selected-user__header > div {
    display: grid;
    gap: 3px;
  }

  .totp-selected-user__header strong {
    color: #17345f;
    font-size: 15px;
    font-weight: 1000;
  }

  .totp-selected-user__header span {
    color: #64748b;
    font-size: 12px;
    font-weight: 750;
  }

  .totp-selected-user__status {
    flex: 0 0 auto;
    min-width: 70px;
    padding: 6px 10px;
    border-radius: 999px;
    text-align: center;
    font-size: 12px !important;
    font-weight: 1000 !important;
  }

  .totp-selected-user__status.is-enabled {
    border: 1px solid #8fd4ad;
    background: #eaf9f0;
    color: #12683b !important;
  }

  .totp-selected-user__status.is-disabled {
    border: 1px solid #efb1b8;
    background: #fff1f2;
    color: #a5283a !important;
  }

  .totp-selected-user__grid {
    display: grid;
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .totp-selected-user__grid > div {
    display: grid;
    gap: 4px;
    min-width: 0;
    padding: 11px 12px;
    border: 1px solid #e0e8e4;
    border-radius: 12px;
    background: rgba(255,255,255,.88);
  }

  .totp-selected-user__grid span {
    color: #708090;
    font-size: 11px;
    font-weight: 800;
  }

  .totp-selected-user__grid strong {
    overflow-wrap: anywhere;
    color: #1e293b;
    font-size: 13px;
    font-weight: 950;
  }

  .totp-selected-user__notice {
    padding: 10px 12px;
    border: 1px dashed #a6beb3;
    border-radius: 11px;
    background: #f5faf7;
    color: #52645b;
    font-size: 12px;
    font-weight: 750;
    line-height: 1.75;
  }

  .totp-inspect-verified {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 12px 14px;
    border: 1px solid #8fd4ad;
    border-radius: 14px;
    background:
      linear-gradient(
        135deg,
        #ebfaf1,
        #f7fcf9
      );
  }

  .totp-inspect-verified__icon {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    border-radius: 50%;
    background: #168a4b;
    color: #ffffff;
    font-size: 19px;
    font-weight: 1000;
  }

  .totp-inspect-verified > div {
    display: grid;
    gap: 2px;
  }

  .totp-inspect-verified strong {
    color: #12683b;
    font-size: 14px;
    font-weight: 1000;
  }

  .totp-inspect-verified span:not(.totp-inspect-verified__icon) {
    color: #557165;
    font-size: 12px;
    font-weight: 750;
  }

  @media (max-width: 720px) {
    .totp-selected-user__grid {
      grid-template-columns: 1fr;
    }

    .totp-selected-user__header {
      align-items: flex-start;
    }
  }

  /* TOTP_SAFE_CONFIRMATION_UI_STYLES */

  .totp-execution-warning {
    display: flex;
    align-items: flex-start;
    gap: 13px;
    padding: 15px 16px;
    border: 1px solid #efc178;
    border-right: 5px solid #d99122;
    border-radius: 15px;
    background:
      linear-gradient(
        135deg,
        #fff9ec 0%,
        #fffdf8 100%
      );
    color: #75480e;
  }

  .totp-execution-warning__icon {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    flex: 0 0 36px;
    border-radius: 50%;
    background: #d99122;
    color: #ffffff;
    font-size: 22px;
    font-weight: 1000;
  }

  .totp-execution-warning > div {
    display: grid;
    gap: 5px;
  }

  .totp-execution-warning strong {
    color: #75480e;
    font-size: 15px;
    font-weight: 1000;
  }

  .totp-execution-warning p {
    margin: 0;
    color: #785722;
    font-size: 13px;
    font-weight: 750;
    line-height: 1.8;
  }

  .totp-execution-warning small {
    color: #93651e;
    font-size: 12px;
    font-weight: 850;
    line-height: 1.7;
  }

  .totp-confirm-match {
    margin-top: -3px;
    padding: 9px 11px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 900;
  }

  .totp-confirm-match.is-pending {
    border: 1px dashed #b8c4cf;
    background: #f7f9fb;
    color: #667789;
  }

  .totp-confirm-match.is-valid {
    border: 1px solid #91d1aa;
    background: #edf9f2;
    color: #12683b;
  }

  .totp-confirm-match.is-invalid {
    border: 1px solid #efb0b8;
    background: #fff2f3;
    color: #a32638;
  }

  .totp-reason-counter {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: -3px;
    padding: 8px 11px;
    border-radius: 10px;
    font-size: 12px;
  }

  .totp-reason-counter span {
    direction: ltr;
    font-weight: 1000;
    white-space: nowrap;
  }

  .totp-reason-counter strong {
    font-weight: 850;
  }

  .totp-reason-counter.is-pending {
    border: 1px dashed #d5b77d;
    background: #fffaf0;
    color: #81591d;
  }

  .totp-reason-counter.is-valid {
    border: 1px solid #91d1aa;
    background: #edf9f2;
    color: #12683b;
  }

  @media (max-width: 720px) {
    .totp-execution-warning {
      flex-direction: column;
    }

    .totp-reason-counter {
      align-items: flex-start;
      flex-direction: column;
    }
  }

  /* TOTP_GRID_COMPACT_V1 */

  .totp-grid {
    align-items: start;
  }

  .totp-grid > .totp-card {
    align-self: start;
    height: auto;
    box-sizing: border-box;
  }

  .totp-card {
    overflow: visible;
  }
  /* TOTP_SECURITY_REAUTH_STYLES */

  .totp-security-reauth {
    display: flex;
    align-items: flex-start;
    gap: 15px;
    margin: 14px 0 20px;
    padding: 18px 20px;
    border: 1px solid #e5b86d;
    border-right: 5px solid #c98518;
    border-radius: 17px;
    background:
      linear-gradient(
        135deg,
        #fff9eb 0%,
        #fffdf7 100%
      );
    box-shadow:
      0 8px 20px rgba(123,82,20,.08);
  }

  .totp-security-reauth__icon {
    display: grid;
    place-items: center;
    width: 46px;
    height: 46px;
    flex: 0 0 46px;
    border-radius: 14px;
    background: #fff0cc;
    font-size: 23px;
  }

  .totp-security-reauth__content {
    display: grid;
    gap: 8px;
    flex: 1;
  }

  .totp-security-reauth__content > strong {
    color: #7a4a08;
    font-size: 16px;
    font-weight: 1000;
  }

  .totp-security-reauth__content > p {
    margin: 0;
    color: #725a35;
    font-size: 13px;
    font-weight: 750;
    line-height: 1.85;
  }

  .totp-security-reauth__content > small {
    color: #806941;
    font-size: 12px;
    font-weight: 750;
    line-height: 1.7;
  }

  .totp-security-reauth__button {
    justify-self: start;
    min-width: 190px;
    margin-top: 2px;
    border-color: #b46f0c !important;
    border-bottom-color: #895306 !important;
    background:
      linear-gradient(
        180deg,
        #d99527,
        #b46f0c
      ) !important;
    box-shadow:
      0 6px 14px rgba(180,111,12,.18) !important;
  }

  .totp-security-reauth__button:hover {
    box-shadow:
      0 9px 19px rgba(180,111,12,.25) !important;
  }

  @media (max-width: 720px) {
    .totp-security-reauth {
      flex-direction: column;
    }

    .totp-security-reauth__button {
      width: 100%;
      justify-self: stretch;
    }
  }
`;

export default function TotpResetAdminPage() {
  const navigate = useNavigate();
  const auth = useAuth() as any;

  const currentEmail =
    String(auth?.user?.email ?? "")
      .trim()
      .toLowerCase();

  const roles = Array.isArray(auth?.roles)
    ? auth.roles.map((role: unknown) =>
        normalizeRole(role)
      )
    : [];

  const directRole = normalizeRole(
    auth?.allow?.role ||
      auth?.profile?.role ||
      auth?.userProfile?.role ||
      ""
  );

  const isOwner =
    currentEmail === OWNER_EMAIL ||
    auth?.isOwner === true ||
    auth?.isSuperAdmin === true ||
    roles.includes("super_admin") ||
    directRole === "super_admin";

  const isMinistry =
    roles.includes("ministry_super") ||
    directRole === "ministry_super";

  const isGovernorate =
    auth?.isSuper === true ||
    roles.includes("super") ||
    directRole === "super" ||
    directRole === "governorate_super";

  const permitted =
    isOwner || isMinistry || isGovernorate;

  const [email, setEmail] = useState("");
  const [target, setTarget] =
    useState<TargetAccount | null>(null);

  const [confirmEmail, setConfirmEmail] =
    useState("");

  const [reason, setReason] =
    useState("");

  const [confirmSelfReset, setConfirmSelfReset] =
    useState(false);

  const [auditItems, setAuditItems] =
    useState<AuditItem[]>([]);

  const [auditLoaded, setAuditLoaded] =
    useState(false);

  
  /* TOTP_AUDIT_DASHBOARD_V1 */
  const [auditQuery, setAuditQuery] =
    useState("");

  const [auditStatus, setAuditStatus] =
    useState("ALL");
const [busy, setBusy] = useState("");

  const resetRequestIdRef =
    useRef<string>("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [managedUsers, setManagedUsers] =
    useState<ManagedUserOption[]>([]);

  const [managedUserQuery, setManagedUserQuery] =
    useState("");

  const [managedUsersLoading, setManagedUsersLoading] =
    useState(false);

  const [managedUsersError, setManagedUsersError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    if (!permitted) {
      return () => {
        cancelled = true;
      };
    }

    setManagedUsersLoading(true);
    setManagedUsersError("");

    void listManagedUsers({})
      .then((response) => {
        if (cancelled) return;

        const normalizedUsers =
          normalizeManagedUsersResponse(response);

        const scopedUsers =
          isOwner
            ? normalizedUsers
            : isMinistry
              ? normalizedUsers.filter(
                  (user) =>
                    normalizeRole(user.role) === "super"
                )
              : isGovernorate
                ? normalizedUsers.filter(
                    (user) =>
                      [
                        "tenant_admin",
                        "admin",
                        "exam_super",
                      ].includes(
                        normalizeRole(user.role)
                      )
                  )
                : [];

        setManagedUsers(scopedUsers);
      })
      .catch((loadError) => {
        console.error(
          "TOTP_MANAGED_USERS_LOAD_FAILED",
          loadError
        );

        if (cancelled) return;

        setManagedUsers([]);

        setManagedUsersError(
          "تعذر تحميل قائمة المستخدمين. يمكنك إدخال البريد الإلكتروني يدويًا ثم فحص الحساب."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setManagedUsersLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [permitted]);

  const ownerSelfReset =
    Boolean(
      isOwner &&
      target &&
      target.email === currentEmail
    );

  /* TOTP_SELECTED_USER_CARD_V1 */
  const selectedManagedUser =
    managedUsers.find(
      (user) =>
        user.email === email.trim().toLowerCase()
    ) ?? null;
  /* TOTP_SECURITY_REAUTH_V1 */

  const securityReauthRequired =
    error ===
      errorMessages.SECOND_FACTOR_ADMIN_SESSION_REQUIRED ||
    error ===
      errorMessages.RECENT_MFA_SIGN_IN_REQUIRED ||
    error.includes("استخدام رمز TOTP") ||
    error.includes("انتهت مدة الجلسة الأمنية") ||
    error.includes("تسجيل دخول المشرف باستخدام المصادقة الثنائية");

  async function beginSecurityReauthentication() {
    const returnTo = "/security/totp-reset";

    setError("");
    setSuccess("");

    // لا نحتفظ بنتيجة فحص قديمة بعد بدء جلسة جديدة.
    setTarget(null);
    resetRequestIdRef.current = "";
    setConfirmEmail("");
    setReason("");
    setConfirmSelfReset(false);

    try {
      window.sessionStorage.setItem(
        "yr:security:postLoginReturn",
        returnTo
      );

      window.sessionStorage.setItem(
        "yr:security:reauthReason",
        "TOTP_ADMIN"
      );
    } catch {
      // sessionStorage مساعد فقط وليس مصدر صلاحية.
    }

    if (typeof auth?.logout !== "function") {
      setError(
        "تعذر بدء إعادة التحقق الأمني لأن وظيفة تسجيل الخروج غير متاحة."
      );
      return;
    }

    try {
      await auth.logout();
    } catch (logoutError) {
      console.error(
        "TOTP_SECURITY_REAUTH_LOGOUT_FAILED",
        logoutError
      );

      setError(
        "تعذر تسجيل الخروج الآمن. لم يتم تجاوز شرط التحقق."
      );
      return;
    }

    navigate("/login", {
      replace: true,
      state: {
        returnTo,
        from: {
          pathname: returnTo,
        },
        reason: "totp-reauth",
      },
    });
  }
  async function inspect(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setTarget(null);

    const normalizedEmail =
      email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("أدخل البريد الإلكتروني للحساب المستهدف.");
      return;
    }

    setBusy("inspect");

    try {
      const response =
        await inspectAccount({
          email: normalizedEmail,
        });

      setTarget(response.target);
      resetRequestIdRef.current = "";
      setEmail(response.target.email);
      setConfirmEmail("");
      setReason("");
      setConfirmSelfReset(false);
    } catch (inspectError) {
      setError(displayError(inspectError));
    } finally {
      setBusy("");
    }
  }

  async function reset() {
    if (!target) {
      setError("افحص الحساب أولًا.");
      return;
    }

    const normalizedConfirmation =
      confirmEmail.trim().toLowerCase();

    const normalizedReason =
      reason.trim();

    if (normalizedConfirmation !== target.email) {
      setError("اكتب البريد المستهدف كاملًا داخل خانة التأكيد.");
      return;
    }

    if (
      normalizedReason.length < 10 ||
      normalizedReason.length > 500
    ) {
      setError("يجب كتابة سبب واضح من 10 إلى 500 حرف.");
      return;
    }

    if (ownerSelfReset && !confirmSelfReset) {
      setError("فعّل تأكيد إعادة تهيئة حساب مالك المنصة.");
      return;
    }

    const requestId =
      resetRequestIdRef.current ||
      createResetRequestId();

    resetRequestIdRef.current = requestId;

    setBusy("reset");
    setError("");
    setSuccess("");

    try {
      const response =
        await resetAccount({
          requestId,
          email: target.email,
          confirmTargetEmail: normalizedConfirmation,
          reason: normalizedReason,
          confirmSelfReset,
        });

      const baseMessage =
        `تمت إعادة تهيئة ${response.targetEmail}. حُذف ${response.removedTotpFactors} عامل TOTP، وحُفظ ${response.preservedOtherFactors} عامل آخر.`;

      setSuccess(
        response.refreshTokensRevoked
          ? `${baseMessage} وتم طلب إبطال الجلسات القديمة.`
          : `${baseMessage} لكن تعذر تأكيد إبطال الجلسات القديمة. راجع سجل العمليات الأمني قبل اعتبار الجلسات القديمة منتهية.`
      );

      resetRequestIdRef.current = "";

      setTarget({
        ...target,
        totpEnrolled: false,
        totpFactorCount: 0,
        factorCount: target.otherFactorCount,
      });

      setConfirmEmail("");
      setReason("");
      setConfirmSelfReset(false);
    } catch (resetError) {
      setError(displayError(resetError));
    } finally {
      setBusy("");
    }
  }
  const auditQueryText =
    auditQuery.trim().toLowerCase();

  const filteredAuditItems =
    auditItems.filter((item) => {
      const normalizedStatus =
        String(item.status || "")
          .trim()
          .toUpperCase();

      if (
        auditStatus !== "ALL" &&
        normalizedStatus !== auditStatus
      ) {
        return false;
      }

      if (!auditQueryText) {
        return true;
      }

      const translatedRole =
        roleLabels[
          normalizeRole(item.targetRole)
        ] || item.targetRole;

      const searchableText = [
        item.status,
        item.actorEmail,
        item.targetEmail,
        item.targetRole,
        translatedRole,
        item.targetGovernorate,
        item.reason,
        item.createdAt,
        item.completedAt,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(
        auditQueryText
      );
    });

  const auditSuccessCount =
    auditItems.filter(
      (item) =>
        String(item.status || "")
          .trim()
          .toUpperCase() === "SUCCESS"
    ).length;

  const auditPartialCount =
    auditItems.filter(
      (item) =>
        String(item.status || "")
          .trim()
          .toUpperCase() ===
        "PARTIAL_SUCCESS"
    ).length;

  const auditOtherCount =
    Math.max(
      0,
      auditItems.length -
        auditSuccessCount -
        auditPartialCount
    );

  function auditStatusLabel(
    status: string
  ) {
    const normalized =
      String(status || "")
        .trim()
        .toUpperCase();

    if (normalized === "SUCCESS") {
      return "ناجحة";
    }

    if (
      normalized === "PARTIAL_SUCCESS"
    ) {
      return "نجاح جزئي";
    }

    if (normalized === "FAILED") {
      return "فشلت";
    }

    if (normalized === "DENIED") {
      return "مرفوضة";
    }

    return status || "غير محددة";
  }
  async function loadAudit() {
    setBusy("audit");
    setAuditLoaded(false);
    setError("");

    try {
      const response =
        await loadAuditRecords({
          limit: 50,
        });

      setAuditItems(
        Array.isArray(response.items)
          ? response.items
          : []
      );
      setAuditLoaded(true);
    } catch (auditError) {
      setError(displayError(auditError));
    } finally {
      setBusy("");
    }
  }

  if (!permitted) {
    return (
      <main className="totp-page">
        <style>{pageCss}</style>

        <section className="totp-shell totp-card">
          <h1>غير مصرح بالدخول</h1>
          <p>
            هذه الصفحة مخصصة لمالك المنصة ومشرف الوزارة ومشرف المحافظة وفق النطاق المعتمد.
          </p>

          <button
            type="button"
            className="totp-button"
            onClick={() => navigate("/")}
          >
            العودة
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="totp-page">
      <style>{pageCss}</style>

      <div className="totp-shell">
        <header className="totp-header">

        {/* TOTP_MINISTRY_BRANDING */}
        <div className="totp-ministry-identity">
          <img
            src="https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png"
            alt="شعار وزارة التعليم"
            className="totp-ministry-logo"
          />
          <div className="totp-ministry-text">
            <strong>سلطنة عمان</strong>
            <span>وزارة التعليم</span>
          </div>
        </div>
          <div>
            <strong>مركز الحماية والمصادقة</strong>
            <h1>إعادة تهيئة رمز TOTP</h1>
            <p>
              إزالة عامل TOTP فقط مع الحفاظ على المستخدم والبريد والدور وربط المدرسة أو المركز.
            </p>
          </div>

          <button
            type="button"
            className="totp-button totp-back"
            onClick={() => navigate("/system/security")}
          >
            العودة إلى الأمن والرقابة
          </button>
        </header>

        {error ? (
          <div
            className="totp-alert totp-error"
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        ) : null}

        {securityReauthRequired ? (
          <section
            className="totp-security-reauth"
            aria-live="polite"
          >
            <div className="totp-security-reauth__icon">
              🔐
            </div>

            <div className="totp-security-reauth__content">
              <strong>
                مطلوب إعادة التحقق الأمني
              </strong>

              <p>
                هذه العملية تتطلب جلسة حديثة تم تسجيل
                الدخول إليها باستخدام عامل TOTP.
                لن يتم تجاوز هذا الشرط أو تعطيله.
              </p>

              <button
                type="button"
                className="totp-button totp-security-reauth__button"
                onClick={() =>
                  void beginSecurityReauthentication()
                }
                disabled={Boolean(busy)}
              >
                إعادة التحقق الأمني
              </button>

              <small>
                سيتم تسجيل الخروج أولًا ثم الانتقال إلى
                تسجيل الدخول. بعد نجاح المصادقة الثنائية
                تكون صفحة إدارة TOTP هي وجهة العودة.
              </small>
            </div>
          </section>
        ) : null}

        {success ? (
          <div
            className="totp-alert totp-success"
            role="status"
            aria-live="polite"
          >
            {success}
          </div>
        ) : null}

        <section className="totp-grid">
          <article className="totp-card">
            <h2>فحص الحساب</h2>

            <form
              className="totp-form"
              onSubmit={inspect}
              aria-busy={busy === "inspect"}
            >
              <div className="totp-user-picker">
                <div className="totp-user-picker__title">
                  اختيار مستخدم من قائمة الإدارة
                </div>

                <input
                  id="totp-managed-user-search"
                  type="search"
                  value={managedUserQuery}
                  onChange={(event) =>
                    setManagedUserQuery(
                      event.target.value
                    )
                  }
                  disabled={
                    Boolean(busy) ||
                    managedUsersLoading
                  }
                  autoComplete="off"
                  placeholder="بحث بالاسم أو البريد أو الدور أو المحافظة..."
                />

                <select
                  value={
                    managedUsers.some(
                      (item) =>
                        item.email ===
                        email.trim().toLowerCase()
                    )
                      ? email.trim().toLowerCase()
                      : ""
                  }
                  onChange={(event) => {
                    const selectedEmail =
                      event.target.value
                        .trim()
                        .toLowerCase();

                    setEmail(selectedEmail);

                    // تغيير الحساب يلغي نتيجة الفحص السابقة.
                    setTarget(null);
                    resetRequestIdRef.current = "";
                    setConfirmEmail("");
                    setReason("");
                    setConfirmSelfReset(false);
                    setError("");
                    setSuccess("");
                  }}
                  disabled={
                    Boolean(busy) ||
                    managedUsersLoading ||
                    managedUsers.length === 0
                  }
                >
                  <option value="">
                    {managedUsersLoading
                      ? "جارٍ تحميل المستخدمين..."
                      : "اختر مستخدمًا"}
                  </option>

                  {managedUsers
                    .filter((user) => {
                      const query =
                        managedUserQuery
                          .trim()
                          .toLowerCase();

                      if (!query) {
                        return true;
                      }

                      return [
                        user.name,
                        user.email,
                        user.role,
                        user.governorate,
                        user.tenantName,
                        user.tenantId,
                      ].some((value) =>
                        String(value || "")
                          .toLowerCase()
                          .includes(query)
                      );
                    })
                    .slice(0, 120)
                    .map((user) => (
                      <option
                        key={user.email}
                        value={user.email}
                      >
                        {[
                          user.name || "بدون اسم",
                          user.email,
                          roleLabels[
                            normalizeRole(user.role)
                          ] ||
                            user.role ||
                            "دور غير محدد",
                          user.governorate,
                          user.tenantName,
                        ]
                          .filter(Boolean)
                          .join(" — ")}
                      </option>
                    ))}
                </select>

                <div className="totp-user-picker__status">
                  {managedUsersLoading
                    ? "يتم تحميل الحسابات من خدمة إدارة المستخدمين..."
                    : managedUsersError
                      ? managedUsersError
                      : `تم تحميل ${managedUsers.length} حسابًا. اختيار الحساب لا ينفذ أي إجراء حتى الضغط على «فحص الحساب».`}
                </div>
              </div>

              <label htmlFor="totp-email">
                البريد الإلكتروني
              </label>

              <input
                id="totp-email"
                className="totp-email-input"
                type="email"
                inputMode="email"
                dir="ltr"
                value={email}
                onChange={(event) => {
                  const nextEmail = event.target.value;
                  const normalizedNextEmail =
                    nextEmail.trim().toLowerCase();

                  setEmail(nextEmail);

                  if (
                    target &&
                    target.email !== normalizedNextEmail
                  ) {
                    setTarget(null);
                    resetRequestIdRef.current = "";
                    setConfirmEmail("");
                    setReason("");
                    setConfirmSelfReset(false);
                  }

                  setError("");
                  setSuccess("");
                }}
                disabled={Boolean(busy)}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="name@example.com"
                aria-describedby="totp-email-help"
              />

              <p
                id="totp-email-help"
                className="totp-field-help"
              >
                أدخل البريد الإلكتروني الكامل للحساب المراد فحصه.
              </p>
              {selectedManagedUser ? (
                <div
                  className="totp-selected-user"
                  aria-live="polite"
                >
                  <div className="totp-selected-user__header">
                    <div>
                      <strong>بيانات المستخدم المختار</strong>
                      <span>
                        بيانات تعريفية قبل الفحص الأمني
                      </span>
                    </div>

                    <span
                      className={`totp-selected-user__status ${
                        selectedManagedUser.enabled
                          ? "is-enabled"
                          : "is-disabled"
                      }`}
                    >
                      {selectedManagedUser.enabled
                        ? "مفعّل"
                        : "غير مفعّل"}
                    </span>
                  </div>

                  <div className="totp-selected-user__grid">
                    <div>
                      <span>الاسم</span>
                      <strong>
                        {selectedManagedUser.name ||
                          "غير مسجل"}
                      </strong>
                    </div>

                    <div>
                      <span>البريد الإلكتروني</span>
                      <strong dir="ltr">
                        {selectedManagedUser.email}
                      </strong>
                    </div>

                    <div>
                      <span>الدور</span>
                      <strong>
                        {roleLabels[
                          normalizeRole(
                            selectedManagedUser.role
                          )
                        ] ||
                          selectedManagedUser.role ||
                          "غير محدد"}
                      </strong>
                    </div>

                    <div>
                      <span>المحافظة</span>
                      <strong>
                        {selectedManagedUser.governorate ||
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <span>المدرسة / المركز</span>
                      <strong>
                        {selectedManagedUser.tenantName ||
                          selectedManagedUser.tenantId ||
                          "—"}
                      </strong>
                    </div>

                    <div>
                      <span>حالة الحساب</span>
                      <strong>
                        {selectedManagedUser.enabled
                          ? "الحساب مفعّل"
                          : "الحساب غير مفعّل"}
                      </strong>
                    </div>
                  </div>

                  <div className="totp-selected-user__notice">
                    هذه البيانات للمساعدة في اختيار الحساب فقط.
                    اضغط «فحص الحساب» للتحقق من الصلاحية
                    وحالة TOTP من الخادم قبل أي إجراء.
                  </div>
                </div>
              ) : null}

              <button
                type="submit"
                className="totp-button"
                disabled={Boolean(busy)}
              >
                {busy === "inspect"
                  ? "جاري الفحص..."
                  : "فحص الحساب"}
              </button>
            </form>

            {!target ? (
              <div
                className={`totp-empty-state${
                  busy === "inspect"
                    ? " totp-loading-state"
                    : ""
                }`}
                aria-live="polite"
              >
                {busy === "inspect"
                  ? "يتم الآن الاتصال بخدمة TOTP وفحص الحساب..."
                  : "لم يتم فحص حساب بعد. أدخل البريد الإلكتروني ثم اضغط فحص الحساب."}
              </div>
            ) : null}

            {target ? (
              <div className="totp-details">
                <div className="totp-inspect-verified">
                  <span className="totp-inspect-verified__icon">✓</span>
                  <div>
                    <strong>تم التحقق من الحساب</strong>
                    <span>
                      البيانات التالية قادمة من خدمة فحص TOTP الآمنة.
                    </span>
                  </div>
                </div>
                <div className="totp-detail">
                  <span>الحساب</span>
                  <strong>{target.email}</strong>
                </div>

                <div className="totp-detail">
                  <span>الدور</span>
                  <strong>
                    {roleLabels[
                      normalizeRole(target.role)
                    ] || target.role}
                  </strong>
                </div>

                <div className="totp-detail">
                  <span>المحافظة</span>
                  <strong>
                    {target.governorate || "غير محددة"}
                  </strong>
                </div>

                <div className="totp-detail">
                  <span>المدرسة أو المركز</span>
                  <strong>
                    {target.tenantId || "غير مربوط"}
                  </strong>
                </div>

                <div className="totp-detail">
                  <span>حالة TOTP</span>
                  <strong>
                    {target.totpEnrolled
                      ? "مسجل"
                      : "غير مسجل"}
                  </strong>
                </div>

                <div className="totp-detail">
                  <span>العوامل الأخرى</span>
                  <strong>
                    {target.otherFactorCount}
                  </strong>
                </div>
              </div>
            ) : null}
          </article>

          <article className="totp-card">
            <h2>التأكيد والتنفيذ الآمن</h2>

            {!target ? (
              <div className="totp-empty-state">
                لن تتاح حقول التأكيد والتنفيذ قبل نجاح فحص الحساب.
              </div>
            ) : (
              <div className="totp-form">
                {/* TOTP_SAFE_CONFIRMATION_UI_V1 */}
                <div className="totp-execution-warning">
                  <span
                    className="totp-execution-warning__icon"
                    aria-hidden="true"
                  >
                    !
                  </span>

                  <div>
                    <strong>عملية أمنية حساسة</strong>

                    <p>
                      تأكد من هوية الحساب قبل التنفيذ. سيعيد
                      الخادم التحقق من الدور والنطاق والصلاحيات
                      قبل السماح بإزالة عامل TOTP.
                    </p>

                    <small>
                      {isOwner
                        ? "نطاق مالك المنصة: تخضع العملية لجميع قيود الحماية والتدقيق على الخادم."
                        : isMinistry
                          ? "نطاق مشرف الوزارة: إعادة التهيئة متاحة لمشرفي المحافظات وفق صلاحيات الخادم."
                          : "نطاق مشرف المحافظة: حسابات المدارس ومراكز الدبلوم داخل المحافظة فقط."}
                    </small>
                  </div>
                </div>
                <label htmlFor="totp-confirm-email">
                  اكتب البريد مرة أخرى
                </label>

                <input
                  id="totp-confirm-email"
                  className="totp-email-input"
                  type="email"
                  inputMode="email"
                  dir="ltr"
                  value={confirmEmail}
                  onChange={(event) =>
                    setConfirmEmail(event.target.value)
                  }
                  disabled={Boolean(busy)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="name@example.com"
                />
                <div
                  className={`totp-confirm-match ${
                    confirmEmail &&
                    target &&
                    confirmEmail.trim().toLowerCase() ===
                      target.email
                      ? "is-valid"
                      : confirmEmail
                        ? "is-invalid"
                        : "is-pending"
                  }`}
                  aria-live="polite"
                >
                  {confirmEmail
                    ? target &&
                      confirmEmail.trim().toLowerCase() ===
                        target.email
                      ? "✓ البريد مطابق للحساب الذي تم فحصه."
                      : "البريد لا يطابق الحساب المستهدف."
                    : "اكتب البريد الكامل للحساب مرة أخرى للتأكيد."}
                </div>

                <label htmlFor="totp-reason">
                  سبب إعادة التهيئة
                </label>

                <textarea
                  id="totp-reason"
                  value={reason}
                  onChange={(event) =>
                    setReason(event.target.value)
                  }
                  rows={5}
                  maxLength={500}
                  disabled={Boolean(busy)}
                />
                <div
                  className={`totp-reason-counter ${
                    reason.trim().length >= 10 &&
                    reason.trim().length <= 500
                      ? "is-valid"
                      : "is-pending"
                  }`}
                  aria-live="polite"
                >
                  <span>
                    {reason.trim().length} / 500
                  </span>

                  <strong>
                    {reason.trim().length === 0
                      ? "اكتب سبب إعادة التهيئة."
                      : reason.trim().length < 10
                        ? `متبقي ${
                            10 - reason.trim().length
                          } أحرف للوصول إلى الحد الأدنى.`
                        : reason.trim().length <= 500
                          ? "✓ السبب مستوفٍ للطول المطلوب."
                          : "السبب تجاوز الحد الأقصى."}
                  </strong>
                </div>

                {ownerSelfReset ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={confirmSelfReset}
                      onChange={(event) =>
                        setConfirmSelfReset(
                          event.target.checked
                        )
                      }
                    />
                    أؤكد إعادة تهيئة حساب مالك المنصة
                  </label>
                ) : null}

                <button
                  type="button"
                  className="totp-button totp-danger"
                  onClick={() => void reset()}
                  disabled={
                    Boolean(busy) ||
                    !target.totpEnrolled
                  }
                >
                  {busy === "reset"
                    ? "جاري التنفيذ..."
                    : "تنفيذ إعادة تهيئة TOTP"}
                </button>
              </div>
            )}
          </article>
        </section>

        {/* TOTP_AUDIT_DASHBOARD_V1 */}
        <section className="totp-card totp-audit">
          <div className="totp-audit__header">
            <div className="totp-audit__heading">
              <span className="totp-audit__eyebrow">
                الرقابة على العمليات الحساسة
              </span>

              <h2>
                سجل عمليات إعادة تهيئة TOTP
              </h2>

              <p>
                يعرض آخر العمليات المتاحة ضمن نطاق صلاحيتك
                من خدمة التدقيق الأمنية المعتمدة.
              </p>
            </div>

            <button
              type="button"
              className="totp-button totp-audit__reload"
              onClick={() => void loadAudit()}
              disabled={Boolean(busy)}
            >
              {busy === "audit"
                ? "جاري تحميل السجل..."
                : auditLoaded
                  ? "تحديث السجل"
                  : "تحميل السجل"}
            </button>
          </div>

          <div
            className="totp-audit__stats"
            aria-label="ملخص سجل عمليات TOTP"
          >
            <article className="totp-audit-stat">
              <span>إجمالي العمليات</span>
              <strong>{auditItems.length}</strong>
              <small>
                من آخر 50 سجلًا متاحًا
              </small>
            </article>

            <article className="totp-audit-stat is-success">
              <span>عمليات ناجحة</span>
              <strong>
                {auditSuccessCount}
              </strong>
              <small>
                مكتملة بنجاح
              </small>
            </article>

            <article className="totp-audit-stat is-partial">
              <span>نجاح جزئي</span>
              <strong>
                {auditPartialCount}
              </strong>
              <small>
                تتطلب مراجعة أمنية
              </small>
            </article>

            <article className="totp-audit-stat is-other">
              <span>حالات أخرى</span>
              <strong>
                {auditOtherCount}
              </strong>
              <small>
                نتائج أخرى مسجلة
              </small>
            </article>
          </div>

          <div className="totp-audit__filters">
            <label className="totp-audit-filter">
              <span>
                البحث في السجل
              </span>

              <input
                type="search"
                value={auditQuery}
                onChange={(event) =>
                  setAuditQuery(
                    event.target.value
                  )
                }
                placeholder="ابحث بالبريد أو الدور أو المحافظة أو السبب..."
                disabled={
                  Boolean(busy) ||
                  !auditLoaded
                }
                autoComplete="off"
              />
            </label>

            <label className="totp-audit-filter">
              <span>
                حالة العملية
              </span>

              <select
                value={auditStatus}
                onChange={(event) =>
                  setAuditStatus(
                    event.target.value
                  )
                }
                disabled={
                  Boolean(busy) ||
                  !auditLoaded
                }
              >
                <option value="ALL">
                  جميع الحالات
                </option>

                <option value="SUCCESS">
                  ناجحة
                </option>

                <option value="PARTIAL_SUCCESS">
                  نجاح جزئي
                </option>

                <option value="FAILED">
                  فشلت
                </option>

                <option value="DENIED">
                  مرفوضة
                </option>
              </select>
            </label>
          </div>

          {auditLoaded ? (
            <div className="totp-audit__summary">
              <span>
                السجلات المعروضة:
                {" "}
                <strong>
                  {filteredAuditItems.length}
                </strong>
                {" "}
                من
                {" "}
                <strong>
                  {auditItems.length}
                </strong>
              </span>

              {(auditQuery ||
                auditStatus !== "ALL") ? (
                <button
                  type="button"
                  className="totp-audit__clear"
                  onClick={() => {
                    setAuditQuery("");
                    setAuditStatus("ALL");
                  }}
                  disabled={Boolean(busy)}
                >
                  مسح عوامل التصفية
                </button>
              ) : null}
            </div>
          ) : null}

          {busy === "audit" ? (
            <div
              className="totp-empty-state totp-loading-state"
              aria-live="polite"
            >
              يتم الآن تحميل سجل العمليات الأمني
              من الخادم...
            </div>
          ) : null}

          {!auditLoaded &&
          busy !== "audit" ? (
            <div className="totp-empty-state">
              لم يتم تحميل السجل بعد.
              اضغط «تحميل السجل» لعرض
              عمليات TOTP المتاحة ضمن صلاحيتك.
            </div>
          ) : null}

          {auditLoaded &&
          !auditItems.length ? (
            <div className="totp-empty-state">
              تم تحميل السجل بنجاح،
              ولا توجد عمليات إعادة تهيئة
              TOTP ظاهرة ضمن نطاقك حتى الآن.
            </div>
          ) : null}

          {auditLoaded &&
          auditItems.length > 0 &&
          filteredAuditItems.length === 0 ? (
            <div className="totp-empty-state">
              لا توجد عمليات تطابق البحث
              أو حالة التصفية الحالية.
            </div>
          ) : null}

          {filteredAuditItems.length ? (
            <div className="totp-table-wrap">
              <table className="totp-table">
                <thead>
                  <tr>
                    <th>النتيجة</th>
                    <th>الحساب المستهدف</th>
                    <th>الدور</th>
                    <th>المحافظة</th>
                    <th>المنفذ</th>
                    <th>سبب العملية</th>
                    <th>وقت التنفيذ</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAuditItems.map(
                    (item) => {
                      const normalizedStatus =
                        String(
                          item.status || ""
                        )
                          .trim()
                          .toUpperCase();

                      const statusClass =
                        normalizedStatus ===
                        "SUCCESS"
                          ? "is-success"
                          : normalizedStatus ===
                              "PARTIAL_SUCCESS"
                            ? "is-partial"
                            : normalizedStatus ===
                                "FAILED"
                              ? "is-failed"
                              : normalizedStatus ===
                                  "DENIED"
                                ? "is-denied"
                                : "is-other";

                      return (
                        <tr key={item.id}>
                          <td>
                            <span
                              className={`totp-audit-status ${statusClass}`}
                              title={item.status}
                            >
                              {auditStatusLabel(
                                item.status
                              )}
                            </span>
                          </td>

                          <td>
                            <span
                              className="totp-audit-email"
                              dir="ltr"
                            >
                              {item.targetEmail ||
                                "—"}
                            </span>
                          </td>

                          <td>
                            <span className="totp-audit-role">
                              {roleLabels[
                                normalizeRole(
                                  item.targetRole
                                )
                              ] ||
                                item.targetRole ||
                                "—"}
                            </span>
                          </td>

                          <td>
                            {item.targetGovernorate ||
                              "—"}
                          </td>

                          <td>
                            <span
                              className="totp-audit-email"
                              dir="ltr"
                            >
                              {item.actorEmail ||
                                "—"}
                            </span>
                          </td>

                          <td>
                            <span
                              className="totp-audit-reason"
                              title={
                                item.reason || ""
                              }
                            >
                              {item.reason || "—"}
                            </span>
                          </td>

                          <td>
                            <span className="totp-audit-date">
                              {formatDate(
                                item.completedAt ||
                                  item.createdAt
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="totp-audit__footer">
            <span>
              مصدر البيانات:
              {" "}
              <strong>
                totpAdminListResetAudit
              </strong>
            </span>

            <span>
              العرض يخضع لصلاحيات الخادم
              ونطاق المستخدم الحالي.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}