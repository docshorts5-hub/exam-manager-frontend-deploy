// src/pages/AddSchoolAdminByGovernorate.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";

import { useAuth } from "../auth/AuthContext";
import { db } from "../firebase/firebase";
import {
  buildAuthzSnapshot,
  canAccessCapability,
  isPlatformOwner,
  resolveRoleBadgeStyle,
} from "../features/authz";
import { MINISTRY_SCOPE } from "../constants/directorates";
import "./AddSchoolAdminByGovernorate.model3.css";
import MINISTRY_LOGO_LOCAL from "../assets/branding/ministry-logo.png";

const MINISTRY_LOGO_URL = MINISTRY_LOGO_LOCAL;

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function getGovernorateValue(...items: any[]) {
  for (const item of items) {
    if (!item) continue;
    const value =
      typeof item === "string"
        ? item
        : item?.governorate ??
          item?.tenantGovernorate ??
          item?.regionAr ??
          item?.governorateAr ??
          item?.scopeGovernorate ??
          item?.gov ??
          "";
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return "";
}

function sameGovernorate(a: unknown, b: unknown) {
  return normalizeText(a).toLowerCase() === normalizeText(b).toLowerCase();
}

function safeDocIdFromEmail(email: string) {
  return normalizeEmail(email);
}

function makeTenantIdFromName(name: string) {
  const arabicMap: Record<string, string> = {
    ا: "a",
    أ: "a",
    إ: "i",
    آ: "a",
    ب: "b",
    ت: "t",
    ث: "th",
    ج: "j",
    ح: "h",
    خ: "kh",
    د: "d",
    ذ: "th",
    ر: "r",
    ز: "z",
    س: "s",
    ش: "sh",
    ص: "s",
    ض: "d",
    ط: "t",
    ظ: "z",
    ع: "a",
    غ: "gh",
    ف: "f",
    ق: "q",
    ك: "k",
    ل: "l",
    م: "m",
    ن: "n",
    ه: "h",
    و: "w",
    ي: "y",
    ى: "a",
    ة: "h",
  };

  const transliterated = normalizeText(name)
    .split("")
    .map((char) => arabicMap[char] || char)
    .join("");

  const cleaned = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);

  return cleaned || `school-${Date.now()}`;
}

function tenantNameOf(tenant: any) {
  return normalizeText(tenant?.name || tenant?.tenantName || tenant?.schoolName || tenant?.title || tenant?.id);
}

function isExamCenterTenant(tenant: any) {
  const values = [tenant?.tenantType, tenant?.type, tenant?.entityType, tenant?.kind, tenant?.category]
    .map((v) => normalizeText(v).toLowerCase())
    .filter(Boolean);

  return (
    tenant?.isExamCenter === true ||
    tenant?.isDiplomaCenter === true ||
    values.some((v) => ["exam_center", "exam-center", "examcenter", "diploma_center", "diploma-center"].includes(v))
  );
}

type TenantRow = {
  id: string;
  name: string;
  governorate: string;
  active?: boolean;
};

type SchoolAdminRow = {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  tenantName: string;
  governorate: string;
  enabled: boolean;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1.5px solid #d5b95f",
  borderRadius: 14,
  padding: "13px 14px",
  background: "#fffdf7",
  color: "#000",
  WebkitTextFillColor: "#000",
  fontWeight: 800,
  fontSize: 15,
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  color: "#111827",
  fontWeight: 900,
};

const buttonStyle: React.CSSProperties = {
  border: "1.5px solid #b58b16",
  background: "linear-gradient(180deg, #f6df83, #d7b83e)",
  borderRadius: 14,
  padding: "12px 18px",
  color: "#000",
  fontWeight: 950,
  cursor: "pointer",
};

function Field(props: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{props.label}</span>
      <input
        type={props.type || "text"}
        value={props.value}
        disabled={props.disabled}
        placeholder={props.placeholder}
        onChange={(e) => props.onChange(e.target.value)}
        style={{ ...inputStyle, opacity: props.disabled ? 0.75 : 1 }}
      />
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{props.label}</span>
      <select
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
        style={{ ...inputStyle, color: "#000", WebkitTextFillColor: "#000", cursor: props.disabled ? "not-allowed" : "pointer" }}
      >
        {props.children}
      </select>
    </label>
  );
}

export default function AddSchoolAdminByGovernorate() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const { user, allow } = auth;
  const authzSnapshot = useMemo(() => buildAuthzSnapshot(auth), [auth]);
  const roleBadge = resolveRoleBadgeStyle(authzSnapshot);
  const isOwner = isPlatformOwner(authzSnapshot);
  const canManageSystem = canAccessCapability(authzSnapshot, "SYSTEM_ADMIN");

  if (!user) return <Navigate to="/login" replace />;
  if (!allow?.enabled) return <Navigate to="/login" replace />;
  if (!canManageSystem) return <Navigate to="/" replace />;

  const myGov = getGovernorateValue(allow, authzSnapshot as any);
  const isMinistryViewer = !isOwner && myGov === MINISTRY_SCOPE;
  const canSeeAllGovs = isOwner || isMinistryViewer;
  const canWrite = isOwner || (!isMinistryViewer && !!myGov);

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [admins, setAdmins] = useState<SchoolAdminRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [editingEmail, setEditingEmail] = useState("");
  const [schoolMode, setSchoolMode] = useState<"existing" | "new">("existing");
  const [newSchoolName, setNewSchoolName] = useState("");
  
  const [newSchoolGovernorate, setNewSchoolGovernorate] = useState(myGov || "");

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.id === selectedTenantId) || null,
    [tenants, selectedTenantId],
  );

  const buildTenantRowFromDoc = (item: any): (TenantRow & { raw: any }) => {
    const data = item.data() as any;
    return {
      id: item.id,
      name: tenantNameOf({ id: item.id, ...data }),
      governorate: getGovernorateValue(data),
      active: data?.enabled !== false && data?.active !== false,
      raw: data,
    };
  };

  const mergeTenantRows = (rows: Array<TenantRow & { raw: any }>) => {
    const map = new Map<string, TenantRow & { raw: any }>();
    for (const row of rows) {
      if (!row?.id) continue;
      if (isExamCenterTenant(row.raw)) continue;
      if (!canSeeAllGovs && !sameGovernorate(row.governorate, myGov)) continue;
      if (!map.has(row.id)) map.set(row.id, row);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  };

  const loadTenants = async () => {
    setError("");
    setLoading(true);
    try {
      let rows: Array<TenantRow & { raw: any }> = [];

      if (canSeeAllGovs) {
        const snap = await getDocs(collection(db, "tenants"));
        rows = snap.docs.map(buildTenantRowFromDoc);
      } else {
        const gov = normalizeText(myGov);
        if (!gov) {
          setTenants([]);
          setSelectedTenantId("");
          setError("ظ„ط§ طھظˆط¬ط¯ ظ…ط­ط§ظپط¸ط© ظˆط§ط¶ط­ط© ظ„ظ„ظ…ط³طھط®ط¯ظ… ط§ظ„ط­ط§ظ„ظٹطŒ ظ„ط°ظ„ظƒ ظ„ط§ ظٹظ…ظƒظ† طھط­ظ…ظٹظ„ ط§ظ„ظ…ط¯ط§ط±ط³.");
          return;
        }

        // ظ…ظ‡ظ… ط¨ط¹ط¯ طھظ‚ظˆظٹط© firestore.rules:
        // ظ…ط´ط±ظپ ط§ظ„ظ…ط­ط§ظپط¸ط© ظ„ط§ ظٹط·ظ„ط¨ ظƒظ„ ط§ظ„ظ…ط¯ط§ط±ط³طŒ ط¨ظ„ ظٹط³طھط¹ظ„ظ… ط¹ظ† ظ…ط¯ط§ط±ط³ ظ…ط­ط§ظپط¸طھظ‡ ظپظ‚ط·.
        // ظ†ط¨ط­ط« ظپظٹ ط£ظƒط«ط± ظ…ظ† ط­ظ‚ظ„ ظ„ط£ظ† ط¨ط¹ط¶ ط§ظ„ط³ط¬ظ„ط§طھ ط§ظ„ظ‚ط¯ظٹظ…ط© طھط­ظپط¸ ط§ظ„ظ…ط­ط§ظپط¸ط© ط¨ط£ط³ظ…ط§ط، ظ…ط®طھظ„ظپط©.
        const governorateFields = ["governorate", "tenantGovernorate", "regionAr", "governorateAr", "scopeGovernorate", "gov"];
        const byId = new Map<string, TenantRow & { raw: any }>();
        const errors: string[] = [];

        for (const field of governorateFields) {
          try {
            const snap = await getDocs(query(collection(db, "tenants"), where(field, "==", gov)));
            for (const item of snap.docs) {
              const row = buildTenantRowFromDoc(item);
              if (!byId.has(row.id)) byId.set(row.id, row);
            }
          } catch (err: any) {
            errors.push(err?.message || field);
          }
        }

        rows = Array.from(byId.values());

        if (!rows.length && errors.length) {
          throw new Error(errors[0] || "Missing or insufficient permissions");
        }
      }

      const normalizedRows = mergeTenantRows(rows);
      setTenants(normalizedRows);
      if (!normalizedRows.some((tenant) => tenant.id === selectedTenantId)) {
        setSelectedTenantId(normalizedRows[0]?.id || "");
      }
    } catch (err: any) {
      setTenants([]);
      setSelectedTenantId("");
      setError(err?.message || "طھط¹ط°ط± طھط­ظ…ظٹظ„ ط§ظ„ظ…ط¯ط§ط±ط³. طھط£ظƒط¯ ظ…ظ† ط§ظ„طµظ„ط§ط­ظٹط§طھ ط£ظˆ ط§ظ„ط§طھطµط§ظ„ ط¨ط§ظ„ط³ط­ط§ط¨ط©.");
    } finally {
      setLoading(false);
    }
  };

  const loadAdmins = async () => {
    setError("");
    try {
      const allowRef = collection(db, "allowlist");
      const snap = canSeeAllGovs
        ? await getDocs(query(allowRef, where("role", "in", ["tenant_admin", "admin"])))
        : await getDocs(
            query(
              allowRef,
              where("role", "in", ["tenant_admin", "admin"]),
              where("governorate", "==", myGov),
            ),
          );

      const rows = snap.docs
        .map((item) => {
          const data = item.data() as any;
          return {
            id: item.id,
            email: normalizeEmail(data.email || item.id),
            name: normalizeText(data.userName || data.name || data.displayName),
            tenantId: normalizeText(data.tenantId),
            tenantName: normalizeText(data.tenantName || data.schoolName || data.name || data.tenantId),
            governorate: getGovernorateValue(data),
            enabled: data.enabled !== false,
          };
        })
        .filter((row) => row.tenantId)
        .filter((row) => (canSeeAllGovs ? true : sameGovernorate(row.governorate, myGov)))
        .sort((a, b) => a.tenantName.localeCompare(b.tenantName, "ar"));

      setAdmins(rows);
    } catch (err: any) {
      setError(err?.message || "طھط¹ط°ط± طھط­ظ…ظٹظ„ ظ…ط¯ط±ط§ط، ط§ظ„ظ…ط¯ط§ط±ط³. ظٹظ…ظƒظ†ظƒ ط§ظ„ط¥ط¶ط§ظپط© ط±ط؛ظ… ط°ظ„ظƒ ط¥ط°ط§ ظƒط§ظ†طھ ط§ظ„طµظ„ط§ط­ظٹط§طھ طھط³ظ…ط­.");
    }
  };

  useEffect(() => {
    void loadTenants();
    void loadAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myGov, isOwner]);

  useEffect(() => {
    if (!isOwner && myGov) setNewSchoolGovernorate(myGov);
  }, [isOwner, myGov]);

  const resetForm = () => {
    setAdminEmail("");
    setAdminName("");
    setEnabled(true);
    setEditingEmail("");
    setNewSchoolName("");
    
    if (!isOwner && myGov) setNewSchoolGovernorate(myGov);
    setMessage("");
    setError("");
  };

  const startEdit = (row: SchoolAdminRow) => {
    setSchoolMode("existing");
    setEditingEmail(row.email);
    setAdminEmail(row.email);
    setAdminName(row.name);
    setSelectedTenantId(row.tenantId);
    setEnabled(row.enabled);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveAdmin = async () => {
    setMessage("");
    setError("");

    const email = normalizeEmail(adminEmail);
    const name = normalizeText(adminName);
    const isCreatingNewSchool = schoolMode === "new";
    const existingTenant = selectedTenant;
    const typedSchoolName = normalizeText(newSchoolName);
    

    const tenantIdPattern = /^[a-zA-Z0-9_-]+$/;

    if (!canWrite) {
      setError("ظ‡ط°ظ‡ ط§ظ„طµظپط­ط© ظ…ط´ط§ظ‡ط¯ط© ظپظ‚ط· ظˆظ„ط§ طھظ…ظ„ظƒ طµظ„ط§ط­ظٹط© ط¥ط¶ط§ظپط© ظ…ط¯ظٹط± ظ…ط¯ط±ط³ط©.");
      return;
    }
    if (!email.includes("@")) {
      setError("ط§ظƒطھط¨ ط¨ط±ظٹط¯ظ‹ط§ ط¥ظ„ظƒطھط±ظˆظ†ظٹظ‹ط§ طµط­ظٹط­ظ‹ط§ ظ„ظ…ط¯ظٹط± ط§ظ„ظ…ط¯ط±ط³ط©.");
      return;
    }
    if (!name) {
      setError("ط§ظƒطھط¨ ط§ط³ظ… ظ…ط¯ظٹط± ط§ظ„ظ…ط¯ط±ط³ط©.");
      return;
    }

    if (!isCreatingNewSchool && !existingTenant?.id) {
      setError("ط§ط®طھط± ط§ظ„ظ…ط¯ط±ط³ط© ط§ظ„طھظٹ ط³ظٹطھظ… ط±ط¨ط· ط§ظ„ظ…ط¯ظٹط± ط¨ظ‡ط§.");
      return;
    }

    if (isCreatingNewSchool && !typedSchoolName) {
      setError("ط§ظƒطھط¨ ط§ط³ظ… ط§ظ„ظ…ط¯ط±ط³ط© ط§ظ„ط¬ط¯ظٹط¯ط©.");
      return;
    }

    const effectiveGovernorate = isCreatingNewSchool
      ? normalizeText(isOwner ? newSchoolGovernorate || myGov : myGov)
      : isOwner
        ? getGovernorateValue(existingTenant)
        : myGov;

    if (!effectiveGovernorate) {
      setError("ظ„ط§ طھظˆط¬ط¯ ظ…ط­ط§ظپط¸ط© ظˆط§ط¶ط­ط© ظ„ظ„ظ…ط¯ط±ط³ط© ط£ظˆ ظ„ظ„ظ…ط³طھط®ط¯ظ… ط§ظ„ط­ط§ظ„ظٹ.");
      return;
    }
    if (!isOwner && !sameGovernorate(effectiveGovernorate, myGov)) {
      setError("ظ„ط§ ظٹظ…ظƒظ† ط±ط¨ط· ظ…ط¯ظٹط± ظ…ط¯ط±ط³ط© ط®ط§ط±ط¬ ظ†ط·ط§ظ‚ ظ…ط­ط§ظپط¸طھظƒ.");
      return;
    }

    const targetTenantId = isCreatingNewSchool
      ? makeTenantIdFromName(typedSchoolName)
      : existingTenant?.id || "";
    const targetTenantName = isCreatingNewSchool
      ? typedSchoolName
      : existingTenant?.name || targetTenantId;

    if (!targetTenantId) {
      setError("طھط¹ط°ط± طھط­ط¯ظٹط¯ ظ…ط¹ط±ظپ ط§ظ„ظ…ط¯ط±ط³ط©.");
      return;
    }

    setSaving(true);
    try {
      if (isCreatingNewSchool) {
        const tenantPayload = {
          name: targetTenantName,
          tenantName: targetTenantName,
          schoolName: targetTenantName,
          title: targetTenantName,
          tenantId: targetTenantId,
          tenantType: "school",
          type: "school",
          entityType: "school",
          kind: "school",
          category: "school",
          isExamCenter: false,
          isDiplomaCenter: false,
          enabled: true,
          active: true,
          governorate: effectiveGovernorate,
          tenantGovernorate: effectiveGovernorate,
          regionAr: effectiveGovernorate,
          governorateAr: effectiveGovernorate,
          scopeGovernorate: effectiveGovernorate,
          createdBy: normalizeEmail(user?.email),
          createdByRole: isOwner ? "platform_owner" : "governorate_super",
          updatedBy: normalizeEmail(user?.email),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        } as any;

        const existingTenantSnap =
          await getDoc(
            doc(db, "tenants", targetTenantId),
          );

        if(existingTenantSnap.exists()){
          setError(
            "Tenant ID موجود مسبقاً. اختر معرفاً آخر.",
          );
          setSaving(false);
          return;
        }

        await setDoc(doc(db, "tenants", targetTenantId), tenantPayload, { merge: true });
        await setDoc(
          doc(db, "tenants", targetTenantId, "meta", "config"),
          {
            ...tenantPayload,
            configType: "school",
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      const payload = {
        email,
        role: "tenant_admin",
        enabled,
        tenantId: targetTenantId,
        tenantName: targetTenantName,
        schoolName: targetTenantName,
        userName: name,
        name,
        governorate: effectiveGovernorate,
        tenantGovernorate: effectiveGovernorate,
        regionAr: effectiveGovernorate,
        governorateAr: effectiveGovernorate,
        scopeGovernorate: effectiveGovernorate,
        scopeType: "tenant",
        createdByRole: isOwner ? "platform_owner" : "governorate_super",
        updatedBy: normalizeEmail(user?.email),
        updatedAt: serverTimestamp(),
      } as any;

      if (!editingEmail) payload.createdAt = serverTimestamp();

      await setDoc(doc(db, "allowlist", safeDocIdFromEmail(email)), payload, { merge: true });

      // ظ…ط³ط§ط± ظ…ط³ط§ط¹ط¯ ظپظ‚ط·. ط¥ط°ط§ ظ„ظ… طھط³ظ…ط­ ظ‚ظˆط§ط¹ط¯ Firestore ط¨ظ‡طŒ ظ„ط§ ظ†ظƒط³ط± ط­ظپط¸ allowlist.
      try {
        await setDoc(
          doc(db, "tenantAdminLinks", targetTenantId),
          {
            tenantId: targetTenantId,
            tenantName: targetTenantName,
            schoolName: targetTenantName,
            email,
            userName: name,
            governorate: effectiveGovernorate,
            tenantGovernorate: effectiveGovernorate,
            enabled,
            updatedBy: normalizeEmail(user?.email),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch {
        // ظ„ط§ ظ†ظˆظ‚ظپ ط§ظ„ط±ط¨ط· ط§ظ„ط£ط³ط§ط³ظٹ ط¥ط°ط§ ظƒط§ظ† ظ‡ط°ط§ ط§ظ„ظ…ط³ط§ط± ط؛ظٹط± ظ…ط³ظ…ظˆط­.
      }

      setMessage(
        editingEmail
          ? "طھظ… طھط­ط¯ظٹط« ظ…ط¯ظٹط± ط§ظ„ظ…ط¯ط±ط³ط© ط¨ظ†ط¬ط§ط­."
          : isCreatingNewSchool
            ? "طھظ… ط¥ظ†ط´ط§ط، ط§ظ„ظ…ط¯ط±ط³ط© ظˆط±ط¨ط· ظ…ط¯ظٹط± ط§ظ„ظ…ط¯ط±ط³ط© ط¨ظ‡ط§ ط¨ظ†ط¬ط§ط­."
            : "طھظ… ط¥ط¶ط§ظپط© ظˆط±ط¨ط· ظ…ط¯ظٹط± ط§ظ„ظ…ط¯ط±ط³ط© ط¨ظ†ط¬ط§ط­.",
      );
      resetForm();
      await loadTenants();
      await loadAdmins();
    } catch (err: any) {
      setError(err?.message || "طھط¹ط°ط± ط­ظپط¸ ظ…ط¯ظٹط± ط§ظ„ظ…ط¯ط±ط³ط©. ط±ط§ط¬ط¹ ظ‚ظˆط§ط¹ط¯ Firestore ظˆط§ظ„طµظ„ط§ط­ظٹط§طھ.");
    } finally {
      setSaving(false);
    }
  };

  const deleteAdmin = async (row: SchoolAdminRow) => {
    if (!canWrite) return;
    if (!window.confirm(`ظ‡ظ„ طھط±ظٹط¯ ط­ط°ظپ ط±ط¨ط· ظ…ط¯ظٹط± ط§ظ„ظ…ط¯ط±ط³ط©طں\n${row.email}`)) return;
    if (!window.confirm("طھط£ظƒظٹط¯ ظ†ظ‡ط§ط¦ظٹ: ط³ظٹطھظ… ط­ط°ظپ ط³ط¬ظ„ ط§ظ„ظ…ط¯ظٹط± ظ…ظ† allowlist ط¥ط°ط§ ظƒط§ظ†طھ ط§ظ„طµظ„ط§ط­ظٹط§طھ طھط³ظ…ط­.")) return;

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await deleteDoc(doc(db, "allowlist", safeDocIdFromEmail(row.email)));
      try {
        if (row.tenantId) await deleteDoc(doc(db, "tenantAdminLinks", row.tenantId));
      } catch {
        // ظ„ط§ ظ†ظˆظ‚ظپ ط§ظ„ط­ط°ظپ ط§ظ„ط£ط³ط§ط³ظٹ.
      }
      setMessage("طھظ… ط­ط°ظپ ظ…ط¯ظٹط± ط§ظ„ظ…ط¯ط±ط³ط© ط¨ظ†ط¬ط§ط­.");
      await loadAdmins();
    } catch (err: any) {
      setError(err?.message || "طھط¹ط°ط± ط­ط°ظپ ظ…ط¯ظٹط± ط§ظ„ظ…ط¯ط±ط³ط© ط¨ط³ط¨ط¨ ط§ظ„طµظ„ط§ط­ظٹط§طھ.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="add-school-admin-model3-force" dir="rtl">
      <section className="add-school-admin-model3-hero" aria-label="ط±ط£ط³ طµظپط­ط© ط¥ط¯ط§ط±ط© ظ…ط¯ط±ط§ط، ط§ظ„ظ…ط¯ط§ط±ط³">
        <div className="add-school-admin-model3-heroIdentity">
          <div className="add-school-admin-model3-logoCard" aria-label="ط´ط¹ط§ط± ظˆط²ط§ط±ط© ط§ظ„طھط±ط¨ظٹط© ظˆط§ظ„طھط¹ظ„ظٹظ…">
            <img src={MINISTRY_LOGO_URL} alt="ط´ط¹ط§ط± ظˆط²ط§ط±ط© ط§ظ„طھط±ط¨ظٹط© ظˆط§ظ„طھط¹ظ„ظٹظ…" />
          </div>

          <div className="add-school-admin-model3-titleBlock">
            <div className="add-school-admin-model3-kicker">ط¨ظˆط§ط¨ط© ظ…ط´ط±ظپ ط§ظ„ظ…ط­ط§ظپط¸ط©</div>
            <h1>ط¥ط¯ط§ط±ط© ظ…ط¯ط±ط§ط، ط§ظ„ظ…ط¯ط§ط±ط³</h1>
            <p>
              ط¥ط¶ط§ظپط© ظˆط±ط¨ط· ظ…ط¯ظٹط± ظ…ط¯ط±ط³ط© ط¯ط§ط®ظ„ ظ†ط·ط§ظ‚ ط§ظ„ظ…ط­ط§ظپط¸ط© ظپظ‚ط·طŒ ظ…ط¹ ط§ظ„ط­ظپط§ط¸ ط¹ظ„ظ‰ ط¹ط²ظ„ ط§ظ„ظ…ط­ط§ظپط¸ط§طھ ظˆط§ظ„طµظ„ط§ط­ظٹط§طھ.
            </p>

            <div className="add-school-admin-model3-badges">
              <span>ظ…ط´ط±ظپ ط§ظ„ظ…ط­ط§ظپط¸ط©</span>
              <span>ط¯ط§ط®ظ„ ظ†ط·ط§ظ‚ ط§ظ„ظ…ط­ط§ظپط¸ط©</span>
              <span>طھط¹ط¯ظٹظ„ طھطµظ…ظٹظ… ظپظ‚ط·</span>
            </div>
          </div>
        </div>

        <div className="add-school-admin-model3-heroActions">
          <button type="button" onClick={() => navigate(isOwner ? "/platform-super-system" : "/super-system")}>ط§ظ„ط¹ظˆط¯ط© ظ„ظ„ط¨ظˆط§ط¨ط© ط§ظ„ط¥ط´ط±ط§ظپظٹط©</button>
        </div>
      </section>

    <main dir="rtl" style={{ minHeight: "100vh", background: "linear-gradient(180deg, #f7f3e7, #efe4c7)", padding: 24, color: "#000" }}>
      <style>{`
        input, select, textarea, option { color: #000 !important; -webkit-text-fill-color: #000 !important; }
        input::placeholder { color: #6b7280 !important; -webkit-text-fill-color: #6b7280 !important; }
        select { background-color: #fffdf7 !important; }
        option { background-color: #ffffff !important; }
      `}</style>
      <section
        style={{
          maxWidth: 1380,
          margin: "0 auto",
          border: "2px solid #caa537",
          borderRadius: 26,
          background: "rgba(255,253,246,0.96)",
          boxShadow: "0 22px 60px rgba(80,60,10,0.12)",
          padding: 24,
        }}
      >
        <header className="add-school-admin-old-inline-header-hidden"
          style={{
            display: "grid",
            gridTemplateColumns: "auto 1fr auto",
            gap: 20,
            alignItems: "center",
            border: "1.5px solid #d4af37",
            borderRadius: 22,
            padding: "18px 22px",
            marginBottom: 22,
            background: "linear-gradient(135deg, #fff8dd, #fffdf7)",
          }}
        >
          <img src={MINISTRY_LOGO_URL} alt="ط´ط¹ط§ط±" style={{ width: 86, height: 86, objectFit: "contain" }} />
          <div>
            <div style={{ fontWeight: 950, fontSize: 30 }}>ط¥ط¶ط§ظپط© ظ…ط¯ظٹط± ظ…ط¯ط±ط³ط©</div>
            <div style={{ fontWeight: 800, marginTop: 8 }}>ط±ط¨ط· ظ…ط¯ظٹط± ظ…ط¯ط±ط³ط© ط¯ط§ط®ظ„ ظ†ط·ط§ظ‚ ط§ظ„ظ…ط­ط§ظپط¸ط© ط¯ظˆظ† طھط¹ط¯ظٹظ„ ط¨ظٹط§ظ†ط§طھ ط§ظ„ظ…ط¯ط±ط³ط©.</div>
            <div style={{ marginTop: 10, color: "#4b5563", fontWeight: 800 }}>{roleBadge.label} â€” {myGov || "ظƒظ„ ط§ظ„ظ…ط­ط§ظپط¸ط§طھ"}</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-start" }}>
            <button style={buttonStyle} onClick={() => navigate(isOwner ? "/platform-super-system" : "/super-system")}>ط§ظ„ط¹ظˆط¯ط© ظ„ظ„ط¨ظˆط§ط¨ط© ط§ظ„ط¥ط´ط±ط§ظپظٹط©</button>
            <button style={{ ...buttonStyle, background: "#fff" }} onClick={() => { void loadTenants(); void loadAdmins(); }}>طھط­ط¯ظٹط«</button>
          </div>
        </header>

        {message ? <div style={{ marginBottom: 14, padding: 14, borderRadius: 14, background: "#ecfdf3", border: "1px solid #86efac", color: "#14532d", fontWeight: 900 }}>{message}</div> : null}
        {error ? <div style={{ marginBottom: 14, padding: 14, borderRadius: 14, background: "#fff1f2", border: "1px solid #fecdd3", color: "#7f1d1d", fontWeight: 900 }}>{error}</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 520px) 1fr", gap: 22, alignItems: "start" }}>
          <section style={{ border: "1.5px solid #d4af37", borderRadius: 22, padding: 20, background: "#fffdf7" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 24, color: "#000" }}>ط¨ظٹط§ظ†ط§طھ ظ…ط¯ظٹط± ط§ظ„ظ…ط¯ط±ط³ط©</h2>
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <span style={labelStyle}>ط·ط±ظٹظ‚ط© ط±ط¨ط· ط§ظ„ظ…ط¯ط±ط³ط©</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    type="button"
                    style={{
                      ...buttonStyle,
                      background: schoolMode === "existing" ? "linear-gradient(180deg, #f6df83, #d7b83e)" : "#fffdf7",
                    }}
                    disabled={!canWrite || !!editingEmail}
                    onClick={() => setSchoolMode("existing")}
                  >
                    ط§ط®طھظٹط§ط± ظ…ظ† ط§ظ„ظ‚ط§ط¦ظ…ط©
                  </button>
                  <button
                    type="button"
                    style={{
                      ...buttonStyle,
                      background: schoolMode === "new" ? "linear-gradient(180deg, #f6df83, #d7b83e)" : "#fffdf7",
                    }}
                    disabled={!canWrite || !!editingEmail}
                    onClick={() => setSchoolMode("new")}
                  >
                    ط¥ط¶ط§ظپط© ظ…ط¯ط±ط³ط© ط¬ط¯ظٹط¯ط©
                  </button>
                </div>
              </div>

              {schoolMode === "existing" ? (
                <SelectField label="ط§ظ„ظ…ط¯ط±ط³ط©" value={selectedTenantId} onChange={setSelectedTenantId} disabled={!canWrite || loading}>
                  <option value="">ط§ط®طھط± ظ…ط¯ط±ط³ط©</option>
                  {tenants.map((tenant) => (
                    <option key={tenant.id} value={tenant.id}>{tenant.name} â€” {tenant.id}</option>
                  ))}
                </SelectField>
              ) : (
                <div style={{ display: "grid", gap: 16, border: "1px dashed #d4af37", borderRadius: 16, padding: 14, background: "#fffaf0" }}>
                  <Field label="ط§ط³ظ… ط§ظ„ظ…ط¯ط±ط³ط© ط§ظ„ط¬ط¯ظٹط¯ط©" value={newSchoolName} disabled={!canWrite || !!editingEmail} placeholder="ظ…ط«ط§ظ„: ظ…ط¯ط±ط³ط© ط¹ط²ط§ظ† ظ„ظ„طھط¹ظ„ظٹظ… ط§ظ„ط£ط³ط§ط³ظٹ" onChange={setNewSchoolName} />
<Field label="ط§ظ„ظ…ط­ط§ظپط¸ط© / ط§ظ„ظ†ط·ط§ظ‚" value={newSchoolGovernorate} disabled={!canWrite || (!isOwner && !!myGov)} placeholder="ط§ظ„ظ…ط­ط§ظپط¸ط© ط£ظˆ ط§ظ„ظ…ط¯ظٹط±ظٹط©" onChange={setNewSchoolGovernorate} />
                </div>
              )}

              <Field label="ط§ظ„ط¨ط±ظٹط¯ ط§ظ„ط¥ظ„ظƒطھط±ظˆظ†ظٹ" value={adminEmail} disabled={!canWrite || !!editingEmail} placeholder="school-admin@example.com" onChange={setAdminEmail} />
              <Field label="ط§ط³ظ… ط§ظ„ظ…ط¯ظٹط±" value={adminName} disabled={!canWrite} placeholder="ط§ط³ظ… ظ…ط¯ظٹط± ط§ظ„ظ…ط¯ط±ط³ط©" onChange={setAdminName} />

              <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
                <input type="checkbox" checked={enabled} disabled={!canWrite} onChange={(e) => setEnabled(e.target.checked)} />
                ظ…ظپط¹ظ„
              </label>

              <button style={{ ...buttonStyle, width: "100%", opacity: saving || !canWrite ? 0.72 : 1 }} disabled={saving || !canWrite} onClick={saveAdmin}>
                {saving ? "ط¬ط§ط±ظچ ط§ظ„ط­ظپط¸..." : editingEmail ? "ط­ظپط¸ ط§ظ„طھط¹ط¯ظٹظ„" : "ط­ظپط¸ ظˆط±ط¨ط· ظ…ط¯ظٹط± ط§ظ„ظ…ط¯ط±ط³ط©"}
              </button>
              {editingEmail ? (
                <button style={{ ...buttonStyle, background: "#fff" }} disabled={saving} onClick={resetForm}>ط¥ظ„ط؛ط§ط، ط§ظ„طھط¹ط¯ظٹظ„</button>
              ) : null}
            </div>
          </section>

          <section style={{ border: "1.5px solid #d4af37", borderRadius: 22, padding: 20, background: "#fffdf7", overflow: "hidden" }}>
            <h2 style={{ margin: "0 0 18px", fontSize: 24, color: "#000" }}>ظ…ط¯ط±ط§ط، ط§ظ„ظ…ط¯ط§ط±ط³ ط§ظ„ظ…ط³ط¬ظ„ظˆظ†</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760, color: "#000" }}>
                <thead>
                  <tr style={{ background: "#f5e6ad" }}>
                    <th style={{ padding: 12, border: "1px solid #e4c86e" }}>ط§ظ„ط¨ط±ظٹط¯</th>
                    <th style={{ padding: 12, border: "1px solid #e4c86e" }}>ط§ظ„ط§ط³ظ…</th>
                    <th style={{ padding: 12, border: "1px solid #e4c86e" }}>ط§ظ„ظ…ط¯ط±ط³ط©</th>
                    <th style={{ padding: 12, border: "1px solid #e4c86e" }}>ط§ظ„ظ…ط­ط§ظپط¸ط©</th>
                    <th style={{ padding: 12, border: "1px solid #e4c86e" }}>ط§ظ„ط­ط§ظ„ط©</th>
                    <th style={{ padding: 12, border: "1px solid #e4c86e" }}>ط¥ط¬ط±ط§ط،ط§طھ</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.length ? admins.map((row) => (
                    <tr key={`${row.email}-${row.tenantId}`}>
                      <td style={{ padding: 12, border: "1px solid #ead896", fontWeight: 850 }}>{row.email}</td>
                      <td style={{ padding: 12, border: "1px solid #ead896" }}>{row.name || "â€”"}</td>
                      <td style={{ padding: 12, border: "1px solid #ead896" }}>{row.tenantName || row.tenantId}</td>
                      <td style={{ padding: 12, border: "1px solid #ead896" }}>{row.governorate || "â€”"}</td>
                      <td style={{ padding: 12, border: "1px solid #ead896" }}>{row.enabled ? "ظ…ظپط¹ظ„" : "ط؛ظٹط± ظ…ظپط¹ظ„"}</td>
                      <td style={{ padding: 12, border: "1px solid #ead896", whiteSpace: "nowrap" }}>
                        <button style={{ ...buttonStyle, padding: "8px 12px", marginInlineEnd: 8 }} disabled={!canWrite} onClick={() => startEdit(row)}>طھط¹ط¯ظٹظ„</button>
                        <button style={{ ...buttonStyle, padding: "8px 12px", background: "#fee2e2", borderColor: "#ef4444" }} disabled={!canWrite} onClick={() => void deleteAdmin(row)}>ط­ط°ظپ</button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} style={{ padding: 24, textAlign: "center", border: "1px solid #ead896", fontWeight: 900 }}>
                        ظ„ط§ طھظˆط¬ط¯ ط³ط¬ظ„ط§طھ ط¸ط§ظ‡ط±ط© ط­طھظ‰ ط§ظ„ط¢ظ†.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </section>
    </main>
  
    </div>
  );
}






