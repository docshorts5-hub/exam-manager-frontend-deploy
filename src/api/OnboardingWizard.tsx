// src/pages/OnboardingWizard.tsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setGeneralSettings } from "../services/settings.service";
import { importTeachersBatch, Teacher } from "../services/teachers.service";
import { useSession } from "../auth/SessionContext";

/**
 * ✅ Simple onboarding wizard (additive).
 * This does NOT replace your current Onboarding page.
 * Wire it later at /onboarding-wizard if you want.
 */

type Step = 1 | 2 | 3;

function parseCSV(text: string) {
  // Very small CSV parser (commas + quoted cells). Good enough for simple sheets.
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cur.trim());
      cur = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (cur.length || row.length) {
        row.push(cur.trim());
        rows.push(row);
      }
      cur = "";
      row = [];
      // swallow \r\n
      if (ch === "\r" && next === "\n") i++;
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) {
    row.push(cur.trim());
    rows.push(row);
  }
  return rows;
}

export default function OnboardingWizard() {
  const nav = useNavigate();
  const { tenantId, user } = useSession();

  const [step, setStep] = useState<Step>(1);
  const [schoolName, setSchoolName] = useState("");
  const [authority, setAuthority] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [term, setTerm] = useState("");

  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<Teacher[]>([]);
  const [busy, setBusy] = useState(false);

  const canRun = useMemo(() => Boolean(tenantId && user?.uid), [tenantId, user?.uid]);

  async function saveSettings() {
    if (!tenantId) return;
    setBusy(true);
    try {
      await setGeneralSettings(tenantId, { schoolName, authority, academicYear, term });
      setStep(2);
    } finally {
      setBusy(false);
    }
  }

  async function handleCSV(file: File) {
    setCsvError(null);
    setCsvRows([]);
    setImportPreview([]);

    const text = await file.text();
    const rows = parseCSV(text).filter((r) => r.some((c) => c.trim().length));
    if (rows.length < 2) {
      setCsvError("CSV فارغ أو لا يحتوي على بيانات.");
      return;
    }

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name.toLowerCase());

    const colEmployeeNo = idx("employeeno");
    const colFullName = idx("fullname");

    if (colEmployeeNo === -1 || colFullName === -1) {
      setCsvError("لازم الأعمدة الأساسية: employeeNo و fullName (بنفس الكتابة).");
      return;
    }

    const preview: Teacher[] = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const employeeNo = (r[colEmployeeNo] || "").trim();
      const fullName = (r[colFullName] || "").trim();
      if (!employeeNo || !fullName) continue;

      preview.push({
        id: employeeNo, // ✅ stable id
        employeeNo,
        fullName,
        subject1: (r[idx("subject1")] || "").trim(),
        subject2: (r[idx("subject2")] || "").trim(),
        subject3: (r[idx("subject3")] || "").trim(),
        subject4: (r[idx("subject4")] || "").trim(),
        grades: (r[idx("grades")] || "").trim(),
        phone: (r[idx("phone")] || "").trim(),
        notes: (r[idx("notes")] || "").trim(),
      });
    }

    if (!preview.length) {
      setCsvError("لم يتم العثور على صفوف صالحة (يجب وجود employeeNo و fullName).");
      return;
    }

    setCsvRows(rows);
    setImportPreview(preview.slice(0, 200));
  }

  async function doImport() {
    if (!tenantId || !user?.uid) return;
    setBusy(true);
    try {
      await importTeachersBatch(tenantId, importPreview);
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (!tenantId) return;
    setBusy(true);
    try {
      await setGeneralSettings(tenantId, { onboardingDone: true });
      nav("/");
    } finally {
      setBusy(false);
    }
  }

  if (!canRun) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Onboarding Wizard</h2>
        <p>يجب تسجيل الدخول + تحديد tenantId في ملف المستخدم أولاً.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h2 style={{ marginBottom: 12 }}>Onboarding Wizard</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <div>Step: {step} / 3</div>
        {busy ? <div>⏳</div> : null}
      </div>

      {step === 1 && (
        <div style={{ display: "grid", gap: 10 }}>
          <h3>1) إعدادات عامة</h3>
          <label>
            اسم المدرسة
            <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} style={{ width: "100%", padding: 8 }} />
          </label>
          <label>
            الجهة
            <input value={authority} onChange={(e) => setAuthority(e.target.value)} style={{ width: "100%", padding: 8 }} />
          </label>
          <label>
            العام الدراسي
            <input value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} style={{ width: "100%", padding: 8 }} />
          </label>
          <label>
            الفصل
            <input value={term} onChange={(e) => setTerm(e.target.value)} style={{ width: "100%", padding: 8 }} />
          </label>

          <button disabled={busy} onClick={saveSettings} style={{ padding: 10 }}>
            حفظ والانتقال
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gap: 10 }}>
          <h3>2) استيراد الكادر التعليمي (CSV)</h3>
          <p style={{ margin: 0 }}>
            الأعمدة المطلوبة: <code>employeeNo</code>, <code>fullName</code> (وباقي الأعمدة اختيارية: subject1..subject4, grades, phone, notes)
          </p>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleCSV(f);
            }}
          />

          {csvError ? <div style={{ color: "crimson" }}>{csvError}</div> : null}

          {importPreview.length ? (
            <>
              <div>Preview: {importPreview.length} rows</div>
              <div style={{ overflow: "auto", border: "1px solid #ddd" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>employeeNo</th>
                      <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>fullName</th>
                      <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>subject1</th>
                      <th style={{ borderBottom: "1px solid #ddd", textAlign: "left", padding: 8 }}>grades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.slice(0, 30).map((t) => (
                      <tr key={t.id}>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>{t.employeeNo}</td>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>{t.fullName}</td>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>{t.subject1}</td>
                        <td style={{ borderBottom: "1px solid #f0f0f0", padding: 8 }}>{t.grades}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button disabled={busy} onClick={() => setStep(1)} style={{ padding: 10 }}>
                  رجوع
                </button>
                <button disabled={busy} onClick={doImport} style={{ padding: 10 }}>
                  تنفيذ الاستيراد
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "grid", gap: 10 }}>
          <h3>3) إنهاء</h3>
          <p style={{ margin: 0 }}>تم حفظ الإعدادات واستيراد الكادر التعليمي. يمكنك الآن إكمال باقي الإعدادات (قاعات/امتحانات).</p>
          <button disabled={busy} onClick={finish} style={{ padding: 10 }}>
            إنهاء والذهاب للوحة التحكم
          </button>
        </div>
      )}
    </div>
  );
}
