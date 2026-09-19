// YR_SUGGESTIONS_FINAL_UI_V1
// YR_SUGGESTIONS_LIGHT_THEME_V1
// YR_SUGGESTIONS_LIGHT_THEME_V2_COMPLETE
import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { useAuth } from "../auth/AuthContext";
import { canAccessCapability, isPlatformOwner } from "../features/authz";
import { db } from "../firebase/firebase";

type TenantScopeRow = {
  id: string;
  name?: string;
  tenantName?: string;
  schoolName?: string;
  governorate?: string;
  tenantGovernorate?: string;
  regionAr?: string;
  tenantType?: string;
  type?: string;
  entityType?: string;
  isExamCenter?: boolean;
  isDiplomaCenter?: boolean;
};

type SuggestionRow = {
  id: string;
  title: string;
  schoolName: string;
  schoolEmail: string;
  notes: string;
  tenantId?: string | null;
  senderUid?: string | null;
  senderEmail?: string | null;
  status?: "new" | "read" | "done" | string;
  adminNote?: string;
  createdAt?: any;
  updatedAt?: any;
  governorate?: string;
  tenantGovernorate?: string;
  regionAr?: string;
};

const GOLD = "#2563eb";
const GOLD_SOFT = "#dbe7f3";
const BG = "#eef7fb";
const CARD = "#ffffff";
const PANEL = "#ffffff";
const TEXT = "#16372c";
const MUTED = "#64748b";

function formatDateTime(value: any) {
  try {
    const date =
      typeof value?.toDate === "function"
        ? value.toDate()
        : value instanceof Date
        ? value
        : null;

    if (!date) return "-";

    return new Intl.DateTimeFormat("ar", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return "-";
  }
}

function statusLabel(status?: string) {
  switch (status) {
    case "new":
      return "جديدة";
    case "read":
      return "تمت القراءة";
    case "done":
      return "تمت المعالجة";
    default:
      return status || "-";
  }
}

function statusColor(status?: string) {
  switch (status) {
    case "new":
      return "#ef4444";
    case "read":
      return "#3b82f6";
    case "done":
      return "#22c55e";
    default:
      return GOLD;
  }
}

function normalizeText(value: any) {
  return String(value || "")
    .trim()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

function readGovernorate(value: any) {
  return String(value?.governorate || value?.tenantGovernorate || value?.regionAr || "").trim();
}

function isSameGovernorate(a: any, b: any) {
  const aa = normalizeText(a);
  const bb = normalizeText(b);
  return Boolean(aa && bb && aa === bb);
}

function isExamCenterRow(value: any) {
  const raw = [value?.tenantType, value?.type, value?.entityType].map((x) => normalizeText(x));
  return Boolean(
    value?.isExamCenter === true ||
      value?.isDiplomaCenter === true ||
      raw.some((x) => ["exam_center", "exam-center", "diploma_center", "diploma-center", "center"].includes(x))
  );
}

export default function SuperSuggestions() {
  const navigate = useNavigate();
  const { profile, authzSnapshot } = useAuth() as any;

  const owner = isPlatformOwner(authzSnapshot);
  const canAccessSystem = canAccessCapability(authzSnapshot, "SYSTEM_ADMIN");
  const canManageSuggestions = Boolean(owner || canAccessSystem);
  const currentGovernorate = readGovernorate(profile);
  const currentTenantId = String(profile?.tenantId || profile?.tenant || profile?.schoolId || "").trim();
  const currentRole = normalizeText(profile?.role);

  const [rows, setRows] = useState<SuggestionRow[]>([]);
  const [tenantScope, setTenantScope] = useState<Record<string, TenantScopeRow>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "new" | "read" | "done">("all");
  const [search, setSearch] = useState("");
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!canManageSuggestions) {
      setTenantScope({});
      return;
    }

    const unsub = onSnapshot(
      collection(db, "tenants"),
      (snap) => {
        const next: Record<string, TenantScopeRow> = {};
        snap.docs.forEach((d) => {
          next[d.id] = { id: d.id, ...(d.data() as any) };
        });
        setTenantScope(next);
      },
      () => setTenantScope({})
    );

    return () => unsub();
  }, [canManageSuggestions]);

  useEffect(() => {
    if (!canManageSuggestions) {
      setRows([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, "systemSuggestions"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as any),
        })) as SuggestionRow[];

        setRows(data);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsub();
  }, [canManageSuggestions]);

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      const tenantId = String(row.tenantId || "").trim();
      const tenant = tenantId ? tenantScope[tenantId] : undefined;
      const rowGovernorate = readGovernorate(row) || readGovernorate(tenant);

      if (owner) return true;

      if (currentTenantId) {
        return tenantId === currentTenantId;
      }

      if (currentRole === "super" || currentRole === "governorate_super") {
        return isSameGovernorate(rowGovernorate, currentGovernorate);
      }

      if (currentRole === "exam_super") {
        return Boolean(tenant && isExamCenterRow(tenant) && tenantId === currentTenantId);
      }

      return canAccessSystem && isSameGovernorate(rowGovernorate, currentGovernorate);
    });
  }, [rows, tenantScope, owner, currentTenantId, currentRole, currentGovernorate, canAccessSystem]);

  const filteredRows = useMemo(() => {
    const s = normalizeText(search);

    return visibleRows.filter((row) => {
      const statusOk = filter === "all" ? true : String(row.status || "new") === filter;
      const tenant = row.tenantId ? tenantScope[String(row.tenantId)] : undefined;

      const text = [
        row.title,
        row.schoolName,
        row.schoolEmail,
        row.notes,
        row.senderEmail,
        row.tenantId,
        readGovernorate(row),
        readGovernorate(tenant),
      ]
        .map(normalizeText)
        .join(" ");

      const searchOk = !s || text.includes(s);

      return statusOk && searchOk;
    });
  }, [visibleRows, filter, search, tenantScope]);

  const stats = useMemo(() => {
    return {
      total: visibleRows.length,
      newCount: visibleRows.filter((r) => (r.status || "new") === "new").length,
      readCount: visibleRows.filter((r) => r.status === "read").length,
      doneCount: visibleRows.filter((r) => r.status === "done").length,
    };
  }, [visibleRows]);

  const changeStatus = async (id: string, status: "new" | "read" | "done") => {
    try {
      setBusyId(id);
      await updateDoc(doc(db, "systemSuggestions", id), {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("changeStatus error:", error);
      alert("تعذر تحديث الحالة.");
    } finally {
      setBusyId("");
    }
  };

  const saveAdminNote = async (id: string) => {
    try {
      setBusyId(id);
      await updateDoc(doc(db, "systemSuggestions", id), {
        adminNote: String(draftNotes[id] || "").trim(),
        updatedAt: serverTimestamp(),
      });
      alert("تم حفظ ملاحظة المشرف.");
    } catch (error) {
      console.error("saveAdminNote error:", error);
      alert("تعذر حفظ ملاحظة المشرف.");
    } finally {
      setBusyId("");
    }
  };

  const removeSuggestion = async (id: string) => {
    if (!owner) {
      alert("الحذف متاح لمالك المنصة فقط.");
      return;
    }

    const ok = window.confirm("هل تريد حذف هذه الرسالة نهائيًا؟");
    if (!ok) return;

    try {
      setBusyId(id);
      await deleteDoc(doc(db, "systemSuggestions", id));
    } catch (error) {
      console.error("delete suggestion error:", error);
      alert("تعذر حذف الرسالة.");
    } finally {
      setBusyId("");
    }
  };

  if (!canManageSuggestions) return <Navigate to="/" replace />;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg,#f4faf7 0%,#eef7fb 58%,#fffaf0 100%)",
        padding: 24,
        direction: "rtl",
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          margin: "0 auto",
          background: CARD,
          border: "1px solid #d8e6df",
          borderRadius: 24,
          boxShadow: "0 18px 44px rgba(15,23,42,0.08)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "10px 18px 14px", background: "transparent", borderBottom: "1px solid #d7e6df" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr 1fr", alignItems: "center", gap: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, justifySelf: "start" }}>
              <img src="https://i.postimg.cc/j5G4NQvZ/sh%CA%BFar-1.png" alt="شعار وزارة التعليم" style={{ width: 72, height: 72, objectFit: "contain", mixBlendMode: "multiply" }} />
              <div style={{ textAlign: "right", color: "#123c2d", fontWeight: 1000, lineHeight: 1.45 }}>
                <div style={{ fontSize: 24 }}>سلطنة عُمان</div>
                <div style={{ fontSize: 19 }}>وزارة التعليم</div>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <h1 style={{ margin: 0, color: "#123c2d", fontSize: 38, fontWeight: 1000 }}>رسائل التطوير</h1>
              <div style={{ marginTop: 5, color: "#64748b", fontWeight: 800 }}>مراجعة الرسائل والمقترحات التشغيلية ومتابعة حالتها.</div>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifySelf: "end" }}>
              <button onClick={() => navigate("/system/operations")} style={{ padding: "10px 15px", borderRadius: 12, border: "1px solid #2563eb", background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "#fff", fontWeight: 900, cursor: "pointer" }}>العودة إلى النظام والتطوير</button>
              <button onClick={() => navigate("/system")} style={{ padding: "10px 15px", borderRadius: 12, border: "1px solid #2563eb", background: "linear-gradient(135deg,#2563eb,#1d4ed8)", color: "#fff", fontWeight: 900, cursor: "pointer" }}>لوحة مالك المنصة</button>
            </div>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <StatCard label="إجمالي الرسائل" value={stats.total} />
            <StatCard label="الجديدة" value={stats.newCount} color="#ef4444" />
            <StatCard label="تمت القراءة" value={stats.readCount} color="#3b82f6" />
            <StatCard label="تمت المعالجة" value={stats.doneCount} color="#22c55e" />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث بعنوان المقترح أو المدرسة أو البريد أو المحتوى"
              style={searchInputStyle}
            />

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
                الكل
              </FilterButton>
              <FilterButton active={filter === "new"} onClick={() => setFilter("new")}>
                جديدة
              </FilterButton>
              <FilterButton active={filter === "read"} onClick={() => setFilter("read")}>
                تمت القراءة
              </FilterButton>
              <FilterButton active={filter === "done"} onClick={() => setFilter("done")}>
                تمت المعالجة
              </FilterButton>
            </div>
          </div>

          {loading ? (
            <div style={emptyBoxStyle}>جارٍ تحميل الرسائل...</div>
          ) : filteredRows.length === 0 ? (
            <div style={emptyBoxStyle}>لا توجد رسائل مطابقة حاليًا.</div>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {filteredRows.map((row) => {
                const currentDraft = draftNotes[row.id] ?? row.adminNote ?? "";
                const currentStatus = row.status || "new";

                return (
                  <div
                    key={row.id}
                    style={{
                      background: PANEL,
                      border: "1px solid #dbe7f3",
                      borderRadius: 18,
                      padding: 18,
                      boxShadow: "0 10px 26px rgba(15,23,42,0.07)",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 12,
                        alignItems: "start",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            color: "#1d4ed8",
                            fontSize: 24,
                            fontWeight: 900,
                            marginBottom: 10,
                          }}
                        >
                          {row.title || "-"}
                        </div>

                        <div style={metaRowStyle}>
                          <strong>اسم المدرسة:</strong> <span>{row.schoolName || "-"}</span>
                        </div>

                        <div style={metaRowStyle}>
                          <strong>إيميل المدرسة:</strong> <span>{row.schoolEmail || "-"}</span>
                        </div>

                        <div style={metaRowStyle}>
                          <strong>Tenant ID:</strong> <span>{row.tenantId || "-"}</span>
                        </div>

                        <div style={metaRowStyle}>
                          <strong>إيميل المرسل:</strong> <span>{row.senderEmail || "-"}</span>
                        </div>

                        <div style={metaRowStyle}>
                          <strong>وقت الإرسال:</strong> <span>{formatDateTime(row.createdAt)}</span>
                        </div>

                        <div style={metaRowStyle}>
                          <strong>الحالة:</strong>{" "}
                          <span
                            style={{
                              color: statusColor(currentStatus),
                              fontWeight: 900,
                            }}
                          >
                            {statusLabel(currentStatus)}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          flexWrap: "wrap",
                          justifyContent: "flex-start",
                        }}
                      >
                        <SmallBtn
                          onClick={() => changeStatus(row.id, "new")}
                          disabled={busyId === row.id}
                          color="#ef4444"
                        >
                          جديدة
                        </SmallBtn>

                        <SmallBtn
                          onClick={() => changeStatus(row.id, "read")}
                          disabled={busyId === row.id}
                          color="#3b82f6"
                        >
                          تمت القراءة
                        </SmallBtn>

                        <SmallBtn
                          onClick={() => changeStatus(row.id, "done")}
                          disabled={busyId === row.id}
                          color="#22c55e"
                        >
                          تمت المعالجة
                        </SmallBtn>

                        {owner ? (
                          <SmallBtn
                            onClick={() => removeSuggestion(row.id)}
                            disabled={busyId === row.id}
                            color="#b91c1c"
                          >
                            حذف
                          </SmallBtn>
                        ) : null}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 16,
                        padding: 14,
                        borderRadius: 14,
                        background: "rgba(255,255,255,0.05)",
                        color: TEXT,
                        whiteSpace: "pre-wrap",
                        lineHeight: 1.9,
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      {row.notes || "-"}
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <div
                        style={{
                          color: TEXT,
                          fontWeight: 800,
                          marginBottom: 8,
                        }}
                      >
                        ملاحظة المشرف
                      </div>

                      <textarea
                        value={currentDraft}
                        onChange={(e) =>
                          setDraftNotes((prev) => ({
                            ...prev,
                            [row.id]: e.target.value,
                          }))
                        }
                        placeholder="اكتب هنا ملاحظة داخلية خاصة بالسوبر أدمن"
                        rows={4}
                        style={noteTextareaStyle}
                      />

                      <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button
                          onClick={() => saveAdminNote(row.id)}
                          disabled={busyId === row.id}
                          style={saveNoteButtonStyle}
                        >
                          {busyId === row.id ? "جارٍ الحفظ..." : "حفظ الملاحظة"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = "#2563eb" }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #dbe7f3", borderTop: "4px solid " + color, borderRadius: 18, padding: "18px 20px", minHeight: 88, boxShadow: "0 8px 22px rgba(15,23,42,0.06)" }}>
      <div style={{ color: "#64748b", fontWeight: 900, fontSize: 15, marginBottom: 8 }}>{label}</div>
      <div style={{ color, fontWeight: 1000, fontSize: 30, lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function FilterButton({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ padding: "11px 16px", borderRadius: 12, border: active ? "1px solid #2563eb" : "1px solid #dbe7f3", background: active ? "linear-gradient(135deg,#2563eb,#1d4ed8)" : "#ffffff", color: active ? "#ffffff" : "#1d4ed8", fontWeight: 900, cursor: "pointer", boxShadow: active ? "0 6px 16px rgba(37,99,235,0.16)" : "none" }}>
      {children}
    </button>
  );
}

function SmallBtn({
  children,
  onClick,
  disabled,
  color,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 12px",
        borderRadius: 12,
        border: `1px solid ${color}`,
        background: `${color}22`,
        color,
        fontWeight: 800,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid #dbe7f3",
  background: "#ffffff",
  color: "#16372c",
  fontSize: 15,
  outline: "none",
};

const metaRowStyle: React.CSSProperties = {
  color: "#475569",
  lineHeight: 1.9,
  marginBottom: 4,
};

const noteTextareaStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 16px",
  borderRadius: 14,
  border: "1px solid #dbe7f3",
  background: "#ffffff",
  color: "#16372c",
  fontSize: 15,
  outline: "none",
  resize: "vertical",
  minHeight: 110,
};

const saveNoteButtonStyle: React.CSSProperties = {
  minWidth: 140,
  padding: "12px 18px",
  borderRadius: 14,
  border: "none",
  cursor: "pointer",
  background: "linear-gradient(135deg,#2563eb,#1d4ed8)",
  color: "#ffffff",
  fontWeight: 900,
  fontSize: 15,
};

const emptyBoxStyle: React.CSSProperties = {
  background: "#f8fbff",
  border: "1px dashed #bfdbfe",
  color: "#475569",
  borderRadius: 16,
  padding: 24,
  textAlign: "center",
  fontWeight: 800,
};
