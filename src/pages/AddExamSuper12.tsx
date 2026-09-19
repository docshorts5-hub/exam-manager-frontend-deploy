// src/pages/AddExamSuper12.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
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
import { buildAuthzSnapshot, isPlatformOwner } from "../features/authz";
import { MINISTRY_SCOPE } from "../constants/directorates";

const MINISTRY_LOGO_URL = "https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png";
const EXAM_SUPER_LINKS_COLLECTION = "governorateExamSupers";

const normalize = (value: unknown) => String(value || "").trim().toLowerCase();

const getGovernorateValue = (...items: any[]) => {
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
    const cleaned = String(value || "").trim();
    if (cleaned) return cleaned;
  }
  return "";
};

const sameGovernorate = (a: unknown, b: unknown) => normalize(a) === normalize(b);

const safeIdPart = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

const safeEmailId = (email: unknown) =>
  String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]+/gi, "_");

const safeLinkId = (email: unknown, tenantId: unknown) => {
  const mail = safeEmailId(email) || "no_email";
  const tenant = safeIdPart(tenantId) || "no_tenant";
  return `${mail}__${tenant}`;
};

const generateTenantId = (name: string) => {
  const base = safeIdPart(name) || "diploma-center";
  return `${base}-${Date.now().toString(36)}`.slice(0, 95);
};

const isExamCenterTenant = (tenant: any) => {
  const values = [tenant?.tenantType, tenant?.type, tenant?.entityType, tenant?.kind, tenant?.category]
    .map(normalize)
    .filter(Boolean);

  return (
    tenant?.isExamCenter === true ||
    tenant?.isDiplomaCenter === true ||
    values.some((v) =>
      [
        "exam_center",
        "exam-center",
        "examcenter",
        "diploma_center",
        "diploma-center",
        "diplomacenter",
        "center",
        "centre",
      ].includes(v),
    )
  );
};

const EXAM_SUPER_ROLE_VALUES = new Set([
  "exam_super",
  "exam-center-super",
  "exam_center_super",
  "سوبر الامتحانات",
  "سوبر امتحانات",
  "سوبر امتحانات الدبلوم",
  "سوبر امتحانات الدبلوم العام",
]);

const PROTECTED_SYSTEM_ROLE_VALUES = new Set([
  "owner",
  "platform_owner",
  "super_admin",
  "superadmin",
  "system_admin",
  "super",
  "governorate_super",
  "regional_super",
  "super_regional",
  "ministry_super",
]);

const readableRole = (role: unknown) => {
  const value = String(role || "").trim();
  return value || "صلاحية غير محددة";
};

type CenterMode = "existing" | "new";

type ExamCenterRow = {
  id: string;
  name: string;
  governorate: string;
  enabled: boolean;
};

type ExamSuperRow = {
  id: string;
  email: string;
  name: string;
  tenantId: string;
  centerName: string;
  governorate: string;
  enabled: boolean;
  source?: "link" | "allowlist";
};

const buildExamCenterPayload = (params: {
  centerId: string;
  centerName: string;
  governorate: string;
  createdBy: string;
  enabled: boolean;
}) => ({
  id: params.centerId,
  tenantId: params.centerId,
  name: params.centerName,
  schoolName: params.centerName,
  tenantName: params.centerName,
  centerName: params.centerName,
  centerNameAr: params.centerName,
  governorate: params.governorate,
  tenantGovernorate: params.governorate,
  regionAr: params.governorate,
  governorateAr: params.governorate,
  scopeGovernorate: params.governorate,
  // Diploma/exam center identity fields.
  // Keep exam_center fields for old code, and diploma fields for the diploma routes.
  type: "diploma",
  tenantType: "diploma",
  entityType: "diploma",
  scopeType: "exam_center",
  centerType: "diploma_center",
  programType: "diploma",
  kind: "diploma_center",
  category: "diploma_center",
  isExamCenter: true,
  isDiplomaCenter: true,
  enabled: params.enabled,
  active: params.enabled,
  createdBy: params.createdBy,
  updatedAt: serverTimestamp(),
});

const buildExamSuperPayload = (params: {
  email: string;
  name: string;
  tenantId: string;
  centerName: string;
  governorate: string;
  enabled: boolean;
  createdBy: string;
}) => ({
  email: params.email,
  role: "exam_super",
  originalRole: "exam_super",
  enabled: params.enabled,
  active: params.enabled,
  userName: params.name,
  name: params.name,
  tenantId: params.tenantId,
  schoolName: params.centerName,
  tenantName: params.centerName,
  centerName: params.centerName,
  centerNameAr: params.centerName,
  governorate: params.governorate,
  tenantGovernorate: params.governorate,
  regionAr: params.governorate,
  governorateAr: params.governorate,
  scopeGovernorate: params.governorate,
  scopeType: "exam_center",
  tenantType: "diploma",
  type: "diploma",
  entityType: "diploma",
  centerType: "diploma_center",
  programType: "diploma",
  isExamCenter: true,
  isDiplomaCenter: true,
  createdBy: params.createdBy,
  updatedAt: serverTimestamp(),
});

export default function AddExamSuper12() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth() as any;
  const { user, allow, profile } = auth;

  const authzSnapshot = useMemo(() => buildAuthzSnapshot(auth), [auth]);
  const owner = isPlatformOwner(authzSnapshot);
  const currentRole = String(allow?.role || profile?.role || authzSnapshot?.roles?.[0] || "")
    .trim()
    .toLowerCase();
  const currentGovernorate = getGovernorateValue(allow, profile, authzSnapshot as any);
  const currentAuthEmails = useMemo(
    () =>
      [
        user?.email,
        allow?.email,
        profile?.email,
        (authzSnapshot as any)?.email,
        (authzSnapshot as any)?.userEmail,
        (authzSnapshot as any)?.authEmail,
      ]
        .map(normalize)
        .filter(Boolean),
    [user?.email, allow?.email, profile?.email, authzSnapshot],
  );
  const isMinistryViewer = !owner && currentGovernorate === MINISTRY_SCOPE;
  const isGovernorateSupervisor =
    !owner &&
    !isMinistryViewer &&
    !!currentGovernorate &&
    ["super", "regional_super", "super_regional", "governorate_super", "governorate-super"].includes(currentRole);
  const canUsePage = owner || isGovernorateSupervisor;

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [centerMode, setCenterMode] = useState<CenterMode>("existing");
  const [selectedCenterId, setSelectedCenterId] = useState("");
  const [newCenterName, setNewCenterName] = useState("");
  const [newCenterId, setNewCenterId] = useState("");
  const [newCenterGovernorate, setNewCenterGovernorate] = useState(currentGovernorate || "");
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [centers, setCenters] = useState<ExamCenterRow[]>([]);
  const [rows, setRows] = useState<ExamSuperRow[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "warn" | "error"; text: string } | null>(null);

  const selectedCenter = useMemo(
    () => centers.find((center) => center.id === selectedCenterId) || null,
    [centers, selectedCenterId],
  );

  const effectiveNewCenterGovernorate = owner ? newCenterGovernorate : currentGovernorate;

  const resetForm = () => {
    setEmail("");
    setName("");
    setCenterMode("existing");
    setSelectedCenterId("");
    setNewCenterName("");
    setNewCenterId("");
    setNewCenterGovernorate(currentGovernorate || "");
    setEnabled(true);
    setEditingRowId(null);
  };

  const loadCenters = async () => {
    setLoading(true);
    try {
      const tenantsRef = collection(db, "tenants");
      const listMap = new Map<string, ExamCenterRow>();

      const addCenterFromSnapshot = (docSnap: any) => {
        const data = docSnap.data() as any;
        const row = { id: docSnap.id, ...data } as any;
        if (!isExamCenterTenant(row)) return;

        const governorate = getGovernorateValue(row);
        if (!owner && !sameGovernorate(governorate, currentGovernorate)) return;

        listMap.set(docSnap.id, {
          id: docSnap.id,
          name: String(data?.name || data?.centerName || data?.schoolName || docSnap.id),
          governorate,
          enabled: data?.enabled !== false,
        });
      };

      if (owner) {
        const snap = await getDocs(tenantsRef);
        snap.forEach(addCenterFromSnapshot);
      } else {
        const governorate = String(currentGovernorate || "").trim();
        if (!governorate) {
          setCenters([]);
          return;
        }

        // بعد تقوية firestore.rules لا يجوز لمشرف المحافظة قراءة كل tenants ثم فلترتها من الواجهة.
        // لذلك نقرأ المراكز باستعلامات مقيدة بالمحافظة نفسها. بعض السجلات القديمة قد تستخدم
        // tenantGovernorate أو regionAr بدل governorate، لذلك نحاول أكثر من حقل بدون إظهار تحذير
        // إذا فشل أحد الاستعلامات، ونكتفي بالنتائج المسموحة.
        const governorateFields = ["governorate", "tenantGovernorate", "regionAr", "governorateAr", "scopeGovernorate"];
        let successfulReads = 0;
        let lastError: unknown = null;

        for (const field of governorateFields) {
          try {
            const snap = await getDocs(query(tenantsRef, where(field, "==", governorate)));
            successfulReads += 1;
            snap.forEach(addCenterFromSnapshot);
          } catch (error) {
            lastError = error;
            console.warn(`tenants query by ${field} skipped`, error);
          }
        }

        if (!successfulReads && lastError) {
          throw lastError;
        }
      }

      const list = Array.from(listMap.values());
      list.sort((a, b) => `${a.governorate} ${a.name}`.localeCompare(`${b.governorate} ${b.name}`, "ar"));
      setCenters(list);
    } catch (error) {
      console.error(error);
      setMessage({
        type: "warn",
        text: "تعذر تحميل مراكز الدبلوم من السحابة. تأكد أن مراكز الدبلوم تحمل نفس محافظة مشرف المحافظة، أو أضف مركزًا جديدًا من النموذج.",
      });
    } finally {
      setLoading(false);
    }
  };

  const addUniqueRow = (map: Map<string, ExamSuperRow>, row: ExamSuperRow) => {
    const key = `${normalize(row.email)}__${row.tenantId}`;
    if (!row.email || !row.tenantId || map.has(key)) return;
    map.set(key, row);
  };

  const loadExamSupers = async () => {
    const map = new Map<string, ExamSuperRow>();

    try {
      const base = collection(db, EXAM_SUPER_LINKS_COLLECTION);
      const snap = owner
        ? await getDocs(base)
        : await getDocs(query(base, where("governorate", "==", currentGovernorate)));

      snap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        addUniqueRow(map, {
          id: docSnap.id,
          email: String(data?.email || ""),
          name: String(data?.name || data?.userName || ""),
          tenantId: String(data?.tenantId || ""),
          centerName: String(data?.centerName || data?.tenantName || data?.schoolName || ""),
          governorate: getGovernorateValue(data),
          enabled: data?.enabled !== false,
          source: "link",
        });
      });
    } catch (error) {
      console.warn("governorateExamSupers read skipped", error);
    }

    try {
      const allowBase = collection(db, "allowlist");
      const allowSnap = owner
        ? await getDocs(query(allowBase, where("role", "==", "exam_super")))
        : await getDocs(query(allowBase, where("role", "==", "exam_super"), where("governorate", "==", currentGovernorate)));

      allowSnap.forEach((docSnap) => {
        const data = docSnap.data() as any;
        addUniqueRow(map, {
          id: safeLinkId(data?.email || docSnap.id, data?.tenantId),
          email: String(data?.email || docSnap.id || ""),
          name: String(data?.name || data?.userName || ""),
          tenantId: String(data?.tenantId || ""),
          centerName: String(data?.centerName || data?.tenantName || data?.schoolName || ""),
          governorate: getGovernorateValue(data),
          enabled: data?.enabled !== false,
          source: "allowlist",
        });
      });
    } catch (error) {
      console.warn("allowlist read skipped", error);
    }

    const list = Array.from(map.values()).filter((row) => owner || sameGovernorate(row.governorate, currentGovernorate));
    list.sort((a, b) => `${a.centerName} ${a.email}`.localeCompare(`${b.centerName} ${b.email}`, "ar"));
    setRows(list);
  };

  useEffect(() => {
    if (!canUsePage) return;
    void loadCenters();
    void loadExamSupers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUsePage, currentGovernorate, owner]);

  if (!user) return <Navigate to="/login" replace />;

  const resolveCenterForSave = async () => {
    if (centerMode === "existing") {
      if (!selectedCenter) throw new Error("اختر مركز امتحانات دبلوم أولاً.");
      if (!selectedCenter.enabled) throw new Error("لا يمكن ربط سوبر امتحانات بمركز غير مفعل.");
      const centerGovernorate = getGovernorateValue(selectedCenter);
      if (!owner && !sameGovernorate(centerGovernorate, currentGovernorate)) {
        throw new Error("لا يمكن ربط سوبر امتحانات بمركز خارج نطاق محافظتك.");
      }
      return {
        id: selectedCenter.id,
        name: selectedCenter.name,
        governorate: centerGovernorate || currentGovernorate,
      };
    }

    const centerName = String(newCenterName || "").trim();
    const governorate = String(effectiveNewCenterGovernorate || "").trim();
    const requestedId = String(newCenterId || "").trim();
    const centerId = requestedId ? safeIdPart(requestedId) : generateTenantId(centerName);

    if (!centerName) throw new Error("يرجى إدخال اسم مركز امتحانات الدبلوم الجديد.");
    if (!centerId) throw new Error("تعذر إنشاء معرف للمركز. اكتب معرفًا يدويًا.");
    if (!governorate) throw new Error("يرجى تحديد محافظة المركز الجديد.");
    if (!owner && !sameGovernorate(governorate, currentGovernorate)) {
      throw new Error("لا يمكن إنشاء مركز خارج نطاق محافظتك.");
    }

    const tenantPayload = buildExamCenterPayload({
      centerId,
      centerName,
      governorate,
      enabled: true,
      createdBy: String(user?.email || ""),
    });

    // لا نقرأ tenant قبل الحفظ حتى لا يفشل مشرف المحافظة بسبب صلاحية get على سجل غير موجود.
    await setDoc(
      doc(db, "tenants", centerId),
      {
        ...tenantPayload,
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );

    await setDoc(
      doc(db, "tenants", centerId, "meta", "config"),
      {
        ...tenantPayload,
        schoolName: centerName,
        title: centerName,
        programType: "diploma",
        createdAt: serverTimestamp(),
      },
      { merge: true },
    );

    return { id: centerId, name: centerName, governorate };
  };

  const saveExamSuper = async () => {
    if (!canUsePage) {
      setMessage({ type: "error", text: "هذه الصفحة متاحة لمالك المنصة أو مشرف المحافظة فقط." });
      return;
    }

    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedName = String(name || "").trim();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      setMessage({ type: "warn", text: "يرجى إدخال بريد إلكتروني صحيح." });
      return;
    }
    if (!normalizedName) {
      setMessage({ type: "warn", text: "يرجى إدخال اسم سوبر الامتحانات." });
      return;
    }

    if (isGovernorateSupervisor && currentAuthEmails.includes(normalizedEmail)) {
      setMessage({
        type: "error",
        text:
          "لا يمكن استخدام بريد الحساب الحالي نفسه كسوبر امتحانات دبلوم، لأن هذا البريد مستخدم للدخول كمشرف محافظة. استخدم بريدًا مستقلًا لسوبر الامتحانات حتى لا يتم كسر الصلاحيات.",
      });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const center = await resolveCenterForSave();

      // فحص آمن للسجل القديم إذا كانت الصلاحيات تسمح بالقراءة.
      // إذا كان البريد موجودًا بصلاحية نظامية أعلى، لا نحاول تحويله إلى exam_super.
      // مشرف المحافظة قد لا يستطيع قراءة بعض السجلات القديمة؛ لذلك لا نعطل الحفظ لمجرد فشل القراءة.
      try {
        const existingSnap = await getDoc(doc(db, "allowlist", normalizedEmail));
        if (existingSnap.exists()) {
          const existingData = existingSnap.data() as any;
          const existingRole = normalize(existingData?.role);
          const existingGov = getGovernorateValue(existingData);

          if (existingRole && !EXAM_SUPER_ROLE_VALUES.has(existingRole)) {
            const isProtected = PROTECTED_SYSTEM_ROLE_VALUES.has(existingRole);
            const govMismatch = existingGov && !sameGovernorate(existingGov, center.governorate || currentGovernorate);

            if (!owner || isProtected || govMismatch) {
              throw new Error(
                `هذا البريد موجود مسبقًا في الصلاحيات بدور: ${readableRole(existingData?.role)}. لا يمكن تحويله مباشرة إلى سوبر امتحانات من هذه الصفحة. استخدم بريدًا جديدًا أو احذف/عدّل السجل القديم من صفحة مالك المنصة.`
              );
            }
          }
        }
      } catch (readOrConflictError: any) {
        const msg = String(readOrConflictError?.message || "");
        const permissionReadError =
          String(readOrConflictError?.code || "").includes("permission") ||
          msg.toLowerCase().includes("permission") ||
          msg.toLowerCase().includes("insufficient");

        if (!permissionReadError) throw readOrConflictError;
      }

      const payload = buildExamSuperPayload({
        email: normalizedEmail,
        name: normalizedName,
        tenantId: center.id,
        centerName: center.name,
        governorate: center.governorate || currentGovernorate,
        enabled,
        createdBy: String(user?.email || ""),
      });

      // مهم: لا نستخدم getDoc على allowlist هنا.
      // مشرف المحافظة غالبًا لا يملك صلاحية قراءة بريد غيره قبل إنشاء السجل، وهذا كان سبب Missing permissions.
      await setDoc(
        doc(db, "allowlist", normalizedEmail),
        {
          ...payload,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );

      await setDoc(
        doc(db, EXAM_SUPER_LINKS_COLLECTION, safeLinkId(normalizedEmail, center.id)),
        {
          ...payload,
          createdAt: serverTimestamp(),
        },
        { merge: true },
      );

      resetForm();
      await loadCenters();
      await loadExamSupers();
      setMessage({ type: "ok", text: "تم حفظ سوبر الامتحانات وربطه بمركز الدبلوم بنجاح." });
    } catch (error: any) {
      console.error(error);
      const rawMessage = String(error?.message || error || "");
      const permissionDenied =
        String(error?.code || "").includes("permission") ||
        rawMessage.toLowerCase().includes("insufficient permissions") ||
        rawMessage.toLowerCase().includes("permission");

      setMessage({
        type: "error",
        text: permissionDenied
          ? "تعذر الحفظ بسبب الصلاحيات. غالبًا البريد موجود مسبقًا في allowlist بصلاحية مختلفة أو لا يتبع نفس المحافظة. استخدم بريدًا جديدًا لسوبر الامتحانات، أو احذف/عدّل السجل القديم من صفحة مالك المنصة، وتأكد أن مركز الدبلوم داخل نفس المحافظة."
          : rawMessage || "تعذر حفظ سوبر الامتحانات. تأكد من الصلاحيات ثم جرّب مرة أخرى.",
      });
    } finally {
      setBusy(false);
    }
  };

  const editRow = (row: ExamSuperRow) => {
    setEditingRowId(row.id);
    setEmail(row.email);
    setName(row.name);
    setCenterMode("existing");
    setSelectedCenterId(row.tenantId);
    setEnabled(row.enabled);
    setMessage({ type: "warn", text: "تم تحميل السجل للتعديل. عدّل البيانات ثم اضغط حفظ التعديل." });
  };

  const deleteRow = async (row: ExamSuperRow) => {
    const ok = window.confirm(`هل تريد حذف سوبر الامتحانات ${row.email}؟`);
    if (!ok) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, EXAM_SUPER_LINKS_COLLECTION, safeLinkId(row.email, row.tenantId)));
      try {
        await deleteDoc(doc(db, "allowlist", row.email));
      } catch (innerError) {
        console.warn("allowlist delete skipped", innerError);
      }
      await loadExamSupers();
      setMessage({ type: "ok", text: "تم حذف السجل من جدول سوبر الامتحانات." });
    } catch (error: any) {
      console.error(error);
      setMessage({ type: "error", text: error?.message || "تعذر حذف السجل." });
    } finally {
      setBusy(false);
    }
  };

  const toggleRowEnabled = async (row: ExamSuperRow, nextEnabled: boolean) => {
    const actionText = nextEnabled ? "تفعيل" : "إلغاء تفعيل";
    const ok = window.confirm(
      nextEnabled
        ? `هل تريد تفعيل سوبر الامتحانات ${row.email}؟ سيتمكن من الدخول إلى مركز الدبلوم.`
        : `هل تريد إلغاء تفعيل سوبر الامتحانات ${row.email}؟ لن يتمكن من الدخول إلى مركز الدبلوم.`
    );
    if (!ok) return;

    setBusy(true);
    setMessage(null);
    try {
      const patch = {
        enabled: nextEnabled,
        active: nextEnabled,
        updatedAt: serverTimestamp(),
        updatedBy: String(user?.email || ""),
      };

      await setDoc(doc(db, "allowlist", row.email), patch, { merge: true });
      await setDoc(doc(db, EXAM_SUPER_LINKS_COLLECTION, safeLinkId(row.email, row.tenantId)), patch, { merge: true });

      await loadExamSupers();
      setMessage({
        type: "ok",
        text: nextEnabled
          ? "تم تفعيل سوبر الامتحانات، ويمكنه الآن الدخول إلى مركز الدبلوم."
          : "تم إلغاء تفعيل سوبر الامتحانات، ولن يستطيع الدخول إلى مركز الدبلوم.",
      });
    } catch (error: any) {
      console.error(error);
      setMessage({
        type: "error",
        text: error?.message || `تعذر تنفيذ ${actionText}. تأكد من الصلاحيات ثم جرّب مرة أخرى.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const deleteAllRows = async () => {
    if (!rows.length) return;
    const first = window.confirm(`سيتم حذف ${rows.length} سجل من سوبر امتحانات الدبلوم الظاهرة في الجدول. هل تريد المتابعة؟`);
    if (!first) return;
    const second = window.confirm("تأكيد نهائي: لا يمكن التراجع عن الحذف الجماعي بعد التنفيذ.");
    if (!second) return;

    setBusy(true);
    try {
      for (const row of rows) {
        await deleteDoc(doc(db, EXAM_SUPER_LINKS_COLLECTION, safeLinkId(row.email, row.tenantId))).catch(() => undefined);
        await deleteDoc(doc(db, "allowlist", row.email)).catch(() => undefined);
      }
      await loadExamSupers();
      setMessage({ type: "ok", text: "تم حذف سجلات سوبر الامتحانات الظاهرة في الجدول." });
    } catch (error: any) {
      console.error(error);
      setMessage({ type: "error", text: error?.message || "تعذر حذف جميع السجلات." });
    } finally {
      setBusy(false);
    }
  };

  const backPath = location.pathname.includes("platform-super-system") ? "/platform-super-system" : "/super-system";

  return (
    <div dir="rtl" className="add-exam-super12-page" style={pageStyle}>
      <style>{blackFieldCss}</style>
      <style>{`
        /* ADD_EXAM_SUPER12_MODEL3_STYLE_V2 */
        .add-exam-super12-page {
          background:
            radial-gradient(1100px 520px at 8% 0%, rgba(16, 185, 129, 0.12), transparent 62%),
            linear-gradient(180deg, #f7f3e7 0%, #efe4c7 100%) !important;
          padding: 24px !important;
          color: #000000 !important;
          box-sizing: border-box !important;
        }

        .add-exam-super12-model3-hero {
          max-width: 1380px;
          margin: 0 auto 22px;
          border: 3px solid #d4af37;
          border-right: 18px solid #0b7f43;
          border-radius: 34px;
          padding: 34px 38px;
          background:
            radial-gradient(circle at 14% 20%, rgba(16, 185, 129, 0.11), transparent 32%),
            linear-gradient(135deg, #fffdf7 0%, #fff9e8 58%, #fffdf7 100%);
          box-shadow: 0 24px 58px rgba(80,60,10,0.13), inset 0 1px 0 rgba(255,255,255,0.82);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          direction: rtl;
        }

        .add-exam-super12-model3-heroIdentity {
          display: flex;
          align-items: center;
          gap: 26px;
          min-width: 0;
        }

        .add-exam-super12-model3-logoCard {
          width: 116px;
          height: 116px;
          border-radius: 24px;
          border: 3px solid #d4af37;
          background: linear-gradient(180deg, #fffdf7 0%, #fff7da 100%);
          display: grid;
          place-items: center;
          box-shadow: 0 14px 30px rgba(150,120,20,0.18);
          flex: 0 0 auto;
        }

        .add-exam-super12-model3-logoCard img {
          width: 94px;
          height: 94px;
          object-fit: contain;
          display: block;
        }

        .add-exam-super12-model3-titleBlock {
          display: grid;
          gap: 8px;
          text-align: right;
        }

        .add-exam-super12-model3-kicker {
          width: max-content;
          max-width: 100%;
          padding: 8px 18px;
          border-radius: 999px;
          background: #dff7e8;
          border: 1.5px solid #9fd6b2;
          color: #087540;
          font-weight: 950;
          font-size: 15px;
        }

        .add-exam-super12-model3-titleBlock h1 {
          margin: 0;
          font-size: clamp(34px, 4vw, 56px);
          line-height: 1.05;
          color: #0f172a;
          font-weight: 1000;
          letter-spacing: -0.5px;
        }

        .add-exam-super12-model3-titleBlock p {
          margin: 0;
          color: #111827;
          font-size: 16px;
          font-weight: 900;
          line-height: 1.8;
        }

        .add-exam-super12-model3-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          margin-top: 4px;
        }

        .add-exam-super12-model3-badges span {
          padding: 9px 16px;
          border-radius: 999px;
          border: 1.5px solid #d4af37;
          background: #fffdf7;
          color: #111827;
          font-weight: 950;
          box-shadow: 0 8px 18px rgba(150,120,20,0.08);
        }

        .add-exam-super12-model3-heroActions button {
          border: 1.5px solid #8ccfa4;
          background: linear-gradient(180deg, #dff7e8, #bdf0ce);
          border-radius: 999px;
          padding: 13px 22px;
          color: #075d34;
          font-weight: 1000;
          cursor: pointer;
          box-shadow: 0 14px 28px rgba(16, 120, 70, 0.13);
          white-space: nowrap;
        }

        .add-exam-super12-old-inline-header-hidden {
          display: none !important;
        }

        .add-exam-super12-page > div {
          max-width: 1380px !important;
          margin: 0 auto !important;
          border: 2px solid #caa537 !important;
          border-radius: 26px !important;
          background: rgba(255,253,246,0.96) !important;
          box-shadow: 0 22px 60px rgba(80,60,10,0.12) !important;
          padding: 24px !important;
          display: grid !important;
          gap: 22px !important;
        }

        .add-exam-super12-model3-contentGrid {
          display: grid !important;
          grid-template-columns: minmax(360px, 520px) 1fr !important;
          gap: 22px !important;
          align-items: start !important;
        }

        .add-exam-super12-model3-contentGrid > section {
          border: 1.5px solid #d4af37 !important;
          border-radius: 22px !important;
          background: #fffdf7 !important;
          padding: 20px !important;
          box-shadow: 0 10px 24px rgba(80,60,20,0.08) !important;
          min-width: 0 !important;
          overflow: hidden !important;
        }

        .add-exam-super12-model3-contentGrid h2 {
          color: #0f3d2a !important;
          font-size: 24px !important;
          font-weight: 950 !important;
        }

        .add-exam-super12-model3-contentGrid input,
        .add-exam-super12-model3-contentGrid select {
          border: 1.5px solid #d5b95f !important;
          border-radius: 14px !important;
          background: #fffdf7 !important;
          color: #000 !important;
          -webkit-text-fill-color: #000 !important;
          font-weight: 850 !important;
        }

        .add-exam-super12-model3-contentGrid table {
          color: #000 !important;
        }

        .add-exam-super12-model3-contentGrid thead tr {
          background: #f5e6ad !important;
        }

        @media (max-width: 1050px) {
          .add-exam-super12-model3-hero {
            flex-direction: column;
            align-items: stretch;
            padding: 26px;
          }

          .add-exam-super12-model3-heroIdentity {
            flex-direction: column;
            align-items: flex-start;
          }

          .add-exam-super12-model3-heroActions {
            display: flex;
            justify-content: flex-start;
          }

          .add-exam-super12-model3-contentGrid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <section className="add-exam-super12-model3-hero" aria-label="رأس صفحة إدارة مشرفي امتحانات الدبلوم">
        <div className="add-exam-super12-model3-heroIdentity">
          <div className="add-exam-super12-model3-logoCard" aria-label="شعار وزارة التربية والتعليم">
            <img src={MINISTRY_LOGO_URL} alt="شعار وزارة التربية والتعليم" />
          </div>

          <div className="add-exam-super12-model3-titleBlock">
            <div className="add-exam-super12-model3-kicker">بوابة مشرف المحافظة</div>
            <h1>إدارة مشرفي امتحانات الدبلوم</h1>
            <p>
              إضافة وربط مشرف امتحانات دبلوم داخل نطاق المحافظة فقط، مع الحفاظ على عزل المحافظات والصلاحيات.
            </p>

            <div className="add-exam-super12-model3-badges">
              <span>مشرف المحافظة</span>
              <span>داخل نطاق المحافظة</span>
              <span>تعديل تصميم فقط</span>
            </div>
          </div>
        </div>

        <div className="add-exam-super12-model3-heroActions">
          <button type="button" onClick={() => navigate(backPath)}>العودة للبوابة الإشرافية</button>
        </div>
      </section>
      <div style={shellStyle}>
        <div className="add-exam-super12-old-inline-header-hidden" style={officialHeaderStyle}>
          <img src={MINISTRY_LOGO_URL} alt="وزارة  التعليم" style={{ width: 84, height: 84, objectFit: "contain" }} />
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#6b4e08" }}>سلطنة عمان — وزارة  التعليم</div>
            <div style={{ fontSize: 30, fontWeight: 950, marginTop: 4 }}>إضافة سوبر امتحانات لمركز دبلوم</div>
            <div style={{ marginTop: 6, color: "#374151", fontWeight: 800 }}>
              ربط سوبر امتحانات بمركز امتحانات دبلوم داخل نطاق المحافظة.
            </div>
            <div style={{ marginTop: 8, color: "#111827", fontWeight: 850 }}>
              النطاق الحالي: {owner ? "مالك المنصة — كل المحافظات" : currentGovernorate || "غير محدد"}
            </div>
          </div>
          <button type="button" onClick={() => navigate(backPath)} style={secondaryButtonStyle}>
            العودة للبوابة الإشرافية
          </button>
        </div>

        {!canUsePage ? <Notice type="error" text="هذه الصفحة متاحة فقط لمالك المنصة أو مشرف المحافظة." /> : null}
        {message ? <Notice type={message.type} text={message.text} onClose={() => setMessage(null)} /> : null}

        <div className="add-exam-super12-model3-contentGrid" style={gridStyle}>
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>{editingRowId ? "تعديل سوبر الامتحانات" : "بيانات سوبر الامتحانات"}</h2>

            <div style={{ display: "grid", gap: 14 }}>
              <LabeledInput label="البريد الإلكتروني">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canUsePage || busy}
                  placeholder="exam-super@example.com"
                  style={fieldStyle}
                />
                <span style={hintStyle}>استخدم بريدًا مستقلًا لسوبر الامتحانات، ولا تستخدم بريد مشرف المحافظة أو بريدًا محفوظًا مسبقًا بصلاحية مختلفة.</span>
              </LabeledInput>

              <LabeledInput label="الاسم">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!canUsePage || busy}
                  placeholder="اسم سوبر الامتحانات"
                  style={fieldStyle}
                />
              </LabeledInput>

              <LabeledInput label="المحافظة / النطاق">
                <input
                  value={owner ? newCenterGovernorate || "حسب مركز الدبلوم المختار" : currentGovernorate}
                  onChange={(e) => setNewCenterGovernorate(e.target.value)}
                  readOnly={!owner}
                  style={{ ...fieldStyle, background: owner ? "#ffffff" : "#f7efd6" }}
                />
              </LabeledInput>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={labelTextStyle}>مركز امتحانات الدبلوم</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => setCenterMode("existing")}
                    style={centerMode === "existing" ? activeModeButtonStyle : modeButtonStyle}
                  >
                    اختيار من القائمة
                  </button>
                  <button
                    type="button"
                    onClick={() => setCenterMode("new")}
                    style={centerMode === "new" ? activeModeButtonStyle : modeButtonStyle}
                  >
                    إضافة مركز جديد
                  </button>
                </div>
              </div>

              {centerMode === "existing" ? (
                <LabeledInput label="اختر مركزًا موجودًا">
                  <select
                    value={selectedCenterId}
                    onChange={(e) => setSelectedCenterId(e.target.value)}
                    disabled={!canUsePage || busy || loading}
                    style={selectFieldStyle}
                  >
                    <option value="" style={optionStyle}>اختر مركز دبلوم</option>
                    {centers.map((center) => (
                      <option key={center.id} value={center.id} style={optionStyle}>
                        {center.name} — {center.governorate || "بدون محافظة"} — {center.id}
                      </option>
                    ))}
                  </select>
                  {!centers.length ? (
                    <span style={hintStyle}>لا توجد مراكز دبلوم داخل النطاق. يمكنك إضافة مركز جديد من نفس النموذج.</span>
                  ) : null}
                </LabeledInput>
              ) : (
                <div style={subCardStyle}>
                  <LabeledInput label="اسم مركز امتحانات الدبلوم الجديد">
                    <input
                      value={newCenterName}
                      onChange={(e) => setNewCenterName(e.target.value)}
                      disabled={!canUsePage || busy}
                      placeholder="مثال: مركز امتحانات دبلوم التعليم العام بعزان"
                      style={fieldStyle}
                    />
                  </LabeledInput>
                  <LabeledInput label="معرف المركز / tenantId اختياري">
                    <input
                      value={newCenterId}
                      onChange={(e) => setNewCenterId(e.target.value)}
                      disabled={!canUsePage || busy}
                      placeholder="مثال: azaanD2026"
                      style={fieldStyle}
                    />
                  </LabeledInput>
                  <div style={hintStyle}>سيتم إنشاء المركز كمركز امتحانات دبلوم ثم ربط سوبر الامتحانات به مباشرة.</div>
                </div>
              )}

              <label style={{ display: "flex", gap: 10, alignItems: "center", fontWeight: 900, color: "#111827" }}>
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} disabled={!canUsePage || busy} />
                مفعل
              </label>

              <div style={{ display: "grid", gridTemplateColumns: editingRowId ? "1fr auto" : "1fr", gap: 10 }}>
                <button type="button" disabled={!canUsePage || busy} onClick={() => void saveExamSuper()} style={primaryButtonStyle}>
                  {busy ? "جارٍ الحفظ..." : editingRowId ? "حفظ التعديل" : "حفظ سوبر الامتحانات"}
                </button>
                {editingRowId ? (
                  <button type="button" disabled={busy} onClick={resetForm} style={secondaryButtonStyle}>
                    إلغاء التعديل
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 8 }}>
              <h2 style={sectionTitleStyle}>سوبر الامتحانات المسجلون</h2>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => void loadExamSupers()} style={smallButtonStyle}>
                  تحديث
                </button>
                <button type="button" onClick={() => void deleteAllRows()} disabled={!rows.length || busy} style={dangerSmallButtonStyle}>
                  حذف جميع سوبر الامتحانات
                </button>
              </div>
            </div>

            <div style={{ overflowX: "auto", border: "1px solid #ead9a6", borderRadius: 14 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 920 }}>
                <thead>
                  <tr style={{ background: "#f3e5b6" }}>
                    <th style={thStyle}>البريد</th>
                    <th style={thStyle}>الاسم</th>
                    <th style={thStyle}>مركز الدبلوم</th>
                    <th style={thStyle}>المحافظة</th>
                    <th style={thStyle}>الحالة</th>
                    <th style={thStyle}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length ? (
                    rows.map((row) => (
                      <tr key={`${row.email}-${row.tenantId}`}>
                        <td style={tdStyle}>{row.email}</td>
                        <td style={tdStyle}>{row.name || "—"}</td>
                        <td style={tdStyle}>{row.centerName || row.tenantId}</td>
                        <td style={tdStyle}>{row.governorate || "—"}</td>
                        <td style={tdStyle}>
                          <span style={row.enabled ? activeBadgeStyle : inactiveBadgeStyle}>
                            {row.enabled ? "مفعل" : "غير مفعل"}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <button type="button" onClick={() => editRow(row)} disabled={busy} style={smallButtonStyle}>
                              تعديل
                            </button>
                            <button type="button" onClick={() => void toggleRowEnabled(row, !row.enabled)} disabled={busy} style={row.enabled ? dangerSmallButtonStyle : successSmallButtonStyle}>
                              {row.enabled ? "إلغاء التفعيل" : "تفعيل"}
                            </button>
                            <button type="button" onClick={() => void deleteRow(row)} disabled={busy} style={dangerSmallButtonStyle}>
                              حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} style={{ ...tdStyle, textAlign: "center", padding: 18 }}>
                        لا توجد سجلات حتى الآن، أو أن السجلات القديمة محفوظة بصلاحية مختلفة. اضغط تحديث بعد الحفظ.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function LabeledInput(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 7, fontWeight: 900, color: "#111827", minWidth: 0 }}>
      <span style={labelTextStyle}>{props.label}</span>
      {props.children}
    </label>
  );
}

function Notice(props: { type: "ok" | "warn" | "error"; text: string; onClose?: () => void }) {
  const palette = {
    ok: { bg: "#ecfdf5", border: "#10b981", color: "#064e3b" },
    warn: { bg: "#fffbeb", border: "#f59e0b", color: "#78350f" },
    error: { bg: "#fff1f2", border: "#ef4444", color: "#7f1d1d" },
  }[props.type];

  return (
    <div
      style={{
        border: `1.5px solid ${palette.border}`,
        background: palette.bg,
        color: palette.color,
        borderRadius: 16,
        padding: "13px 16px",
        fontWeight: 900,
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "center",
      }}
    >
      <span>{props.text}</span>
      {props.onClose ? (
        <button type="button" onClick={props.onClose} style={{ ...smallButtonStyle, background: "#fff" }}>
          ×
        </button>
      ) : null}
    </div>
  );
}

const blackFieldCss = `
  .add-exam-super12-page input,
  .add-exam-super12-page select,
  .add-exam-super12-page textarea,
  .add-exam-super12-page option {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    caret-color: #000000 !important;
    font-weight: 850 !important;
  }

  .add-exam-super12-page input::placeholder,
  .add-exam-super12-page textarea::placeholder {
    color: #111827 !important;
    -webkit-text-fill-color: #111827 !important;
    opacity: 0.75 !important;
  }

  .add-exam-super12-page input:disabled,
  .add-exam-super12-page select:disabled,
  .add-exam-super12-page textarea:disabled {
    color: #000000 !important;
    -webkit-text-fill-color: #000000 !important;
    opacity: 1 !important;
    background: #f7efd6 !important;
  }
`;

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f8f2e4 0%, #efe3c8 100%)",
  color: "#111827",
  padding: 24,
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};

const shellStyle: React.CSSProperties = {
  maxWidth: 1500,
  margin: "0 auto",
  display: "grid",
  gap: 18,
};

const officialHeaderStyle: React.CSSProperties = {
  border: "1.5px solid #c9aa55",
  borderRadius: 24,
  background: "rgba(255, 252, 242, 0.97)",
  boxShadow: "0 16px 36px rgba(80, 60, 20, 0.12)",
  padding: 24,
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  gap: 20,
  alignItems: "center",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(420px, 0.95fr) minmax(620px, 1.25fr)",
  gap: 18,
  alignItems: "start",
};

const cardStyle: React.CSSProperties = {
  border: "1.5px solid #c9aa55",
  borderRadius: 22,
  background: "#fffdf7",
  padding: 22,
  boxShadow: "0 10px 24px rgba(80,60,20,0.08)",
  minWidth: 0,
  overflow: "hidden",
};

const subCardStyle: React.CSSProperties = {
  border: "1px solid #ead9a6",
  borderRadius: 16,
  background: "#fffaf0",
  padding: 14,
  display: "grid",
  gap: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 0,
  marginBottom: 16,
  fontSize: 24,
  fontWeight: 950,
  color: "#111827",
};

const labelTextStyle: React.CSSProperties = {
  color: "#111827",
  fontWeight: 900,
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1.5px solid #c9aa55",
  borderRadius: 12,
  padding: "12px 14px",
  background: "#ffffff",
  color: "#000000",
  WebkitTextFillColor: "#000000",
  fontWeight: 850,
  outline: "none",
};

const selectFieldStyle: React.CSSProperties = {
  ...fieldStyle,
  color: "#000000",
  WebkitTextFillColor: "#000000",
  backgroundColor: "#ffffff",
};

const optionStyle: React.CSSProperties = {
  color: "#000000",
  backgroundColor: "#ffffff",
  fontWeight: 850,
};

const hintStyle: React.CSSProperties = {
  color: "#7c2d12",
  fontSize: 13,
  fontWeight: 850,
};

const primaryButtonStyle: React.CSSProperties = {
  border: "1px solid #9b750e",
  borderRadius: 13,
  background: "linear-gradient(180deg, #f8d66d, #d4af37)",
  color: "#111827",
  padding: "14px 18px",
  fontWeight: 950,
  cursor: "pointer",
  boxShadow: "0 10px 20px rgba(120, 80, 0, 0.16)",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #b8870b",
  borderRadius: 12,
  background: "#fff7df",
  color: "#111827",
  padding: "12px 18px",
  fontWeight: 900,
  cursor: "pointer",
};

const modeButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  background: "#ffffff",
  boxShadow: "none",
};

const activeModeButtonStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
  background: "#f6e49f",
  border: "2px solid #9b750e",
  boxShadow: "0 8px 16px rgba(120, 80, 0, 0.12)",
};

const smallButtonStyle: React.CSSProperties = {
  border: "1px solid #c9aa55",
  borderRadius: 10,
  background: "#fff7df",
  color: "#111827",
  padding: "8px 12px",
  fontWeight: 900,
  cursor: "pointer",
};

const dangerSmallButtonStyle: React.CSSProperties = {
  ...smallButtonStyle,
  border: "1px solid #dc2626",
  background: "#fff1f2",
  color: "#7f1d1d",
};

const successSmallButtonStyle: React.CSSProperties = {
  ...smallButtonStyle,
  border: "1px solid #16a34a",
  background: "#ecfdf5",
  color: "#065f46",
};

const activeBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 999,
  padding: "5px 12px",
  background: "#dcfce7",
  color: "#166534",
  border: "1px solid #22c55e",
  fontWeight: 950,
};

const inactiveBadgeStyle: React.CSSProperties = {
  ...activeBadgeStyle,
  background: "#fff1f2",
  color: "#991b1b",
  border: "1px solid #ef4444",
};

const thStyle: React.CSSProperties = {
  borderBottom: "1px solid #d6bd75",
  padding: "12px 10px",
  textAlign: "right",
  fontWeight: 950,
  color: "#111827",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #efe4bf",
  padding: "11px 10px",
  color: "#111827",
  fontWeight: 750,
  verticalAlign: "top",
};
