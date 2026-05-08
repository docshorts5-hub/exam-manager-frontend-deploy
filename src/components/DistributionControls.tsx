import React from "react";
import {
  card,
  cardHeaderRow,
  cardTitle,
  cardSub,
  input3D,
  ui,
} from "../styles/ui";

/* =========================
   Types
========================= */
export type DistributionControlsState = {
  avoidBackToBack: boolean;
  smartBySpecialty: boolean;
  freeAllForCorrection: boolean;
  allowTwoPeriodsSameDay: boolean;

  roomsGrade10: number;
  roomsGrade11: number;
  roomsOthers: number;

  maxTasksPerTeacher: number;
  dailyReserve: number;
  correctionDays: number;
};

type Props = {
  value: DistributionControlsState;
  onChange: (v: DistributionControlsState) => void;
};

/* =========================
   Reusable Switch
========================= */
function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 26,
        borderRadius: 20,
        background: checked ? ui.primary : "#d1d5db",
        cursor: "pointer",
        position: "relative",
        transition: "0.2s",
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          position: "absolute",
          top: 3,
          left: checked ? 21 : 3,
          transition: "0.2s",
          boxShadow: "0 2px 6px rgba(0,0,0,.25)",
        }}
      />
    </div>
  );
}

/* =========================
   Component
========================= */
export default function DistributionControls({ value, onChange }: Props) {
  function set<K extends keyof DistributionControlsState>(
    key: K,
    v: DistributionControlsState[K]
  ) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
        gap: 16,
      }}
    >
      {/* =========================
          خيارات متقدمة
      ========================= */}
      <div style={card}>
        <div style={cardHeaderRow}>
          <div>
            <div style={cardTitle}>خيارات متقدمة</div>
            <div style={cardSub}>الخوارزمية الذكية</div>
          </div>
        </div>

        <Option
          label="تجنب المهام المتتالية (Back-to-Back)"
          checked={value.avoidBackToBack}
          onChange={(v) => set("avoidBackToBack", v)}
        />
        <Option
          label="توزيع ذكي حسب التخصص"
          checked={value.smartBySpecialty}
          onChange={(v) => set("smartBySpecialty", v)}
        />
        <Option
          label="تفريغ جميع معلمي المادة للتصحيح"
          checked={value.freeAllForCorrection}
          onChange={(v) => set("freeAllForCorrection", v)}
        />
        <Option
          label="السماح بفترتين في اليوم الواحد"
          checked={value.allowTwoPeriodsSameDay}
          onChange={(v) => set("allowTwoPeriodsSameDay", v)}
        />
      </div>

      {/* =========================
          إعدادات القاعات
      ========================= */}
      <div style={card}>
        <div style={cardHeaderRow}>
          <div>
            <div style={cardTitle}>إعدادات القاعات</div>
            <div style={cardSub}>توزيع المراقبين</div>
          </div>
        </div>

        <InputRow
          label="صفوف 10"
          value={value.roomsGrade10}
          onChange={(v) => set("roomsGrade10", v)}
        />
        <InputRow
          label="صفوف 11"
          value={value.roomsGrade11}
          onChange={(v) => set("roomsGrade11", v)}
        />
        <InputRow
          label="أخرى (12)"
          value={value.roomsOthers}
          onChange={(v) => set("roomsOthers", v)}
        />
      </div>

      {/* =========================
          القيود والنصاب
      ========================= */}
      <div style={card}>
        <div style={cardHeaderRow}>
          <div>
            <div style={cardTitle}>القيود والنصاب</div>
            <div style={cardSub}>الحد الأقصى للمهام</div>
          </div>
        </div>

        <InputRow
          label="الحد الأقصى للمهام"
          value={value.maxTasksPerTeacher}
          onChange={(v) => set("maxTasksPerTeacher", v)}
        />
        <InputRow
          label="الاحتياط اليومي"
          value={value.dailyReserve}
          onChange={(v) => set("dailyReserve", v)}
        />
        <InputRow
          label="حد أيام التصحيح"
          value={value.correctionDays}
          onChange={(v) => set("correctionDays", v)}
        />
      </div>
    </div>
  );
}

/* =========================
   Small Helpers
========================= */
function Option({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid #f1f5f9",
        fontWeight: 600,
      }}
    >
      <span>{label}</span>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

function InputRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <input
        type="number"
        style={input3D}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
      />
    </div>
  );
}
