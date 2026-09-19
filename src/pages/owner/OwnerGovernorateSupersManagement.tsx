import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase/firebase";

import OwnerDashboardShell from "./OwnerDashboardShell";
import OwnerGovernorateGuideStep from "./components/OwnerGovernorateGuideStep";
import { OMAN_GOVERNORATES } from "../../constants/omanGovernorates";
import { useAuth } from "../../auth/AuthContext";
import { buildAuthzSnapshot, isPlatformOwner } from "../../features/authz";
type GovernorateSupervisorRow = {
  id: string;
  role?: string;
  governorate?: string;
  enabled?: boolean;
  name?: string;
  email?: string;
};


export default function OwnerGovernorateSupersManagement() {
  const auth = useAuth() as any;
  const navigate = useNavigate();

  const [governorateSupervisorRows, setGovernorateSupervisorRows] =
    useState<GovernorateSupervisorRow[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "allowlist"),
      (snapshot) => {
        const nextRows: GovernorateSupervisorRow[] = [];

        snapshot.forEach((item) => {
          const data = item.data() as Omit<GovernorateSupervisorRow, "id">;

          const role = String(data.role || "")
            .trim()
            .toLowerCase();

          if (role !== "super") return;

          nextRows.push({
            id: item.id,
            role,
            governorate: String(data.governorate || "").trim(),
            enabled: data.enabled !== false,

            name: String(
              (data as any).name ||
              (data as any).displayName ||
              (data as any).userName ||
              ""
            ).trim(),

            email: String(
              (data as any).email ||
              item.id
            ).trim(),
          });
        });

        setGovernorateSupervisorRows(nextRows);
      },
      (error) => {
        console.error(
          "OWNER_GOVERNORATE_SUPERVISOR_STATS_FAILED",
          error
        );

        setGovernorateSupervisorRows([]);
      }
    );

    return () => unsubscribe();
  }, []);

  const governorateStats = useMemo(() => {

  const supervisors =
    governorateSupervisorRows.length;


  const linkedGovernorates =
    new Set(
      governorateSupervisorRows
        .map(
          (row) =>
            String(
              row.governorate || ""
            ).trim()
        )
        .filter(Boolean)
    ).size;


  const active =
    governorateSupervisorRows.filter(
      (row) =>
        row.enabled !== false
    ).length;


  return {
    supervisors,
    governorates: linkedGovernorates,
    active,
  };

}, [governorateSupervisorRows]);

  const governorateGroups = useMemo(() => {
    const map = new Map<
      string,
      GovernorateSupervisorRow[]
    >();

    for (const row of governorateSupervisorRows) {
      const governorate =
        String(row.governorate || "").trim();

      if (!governorate) continue;

      const current =
        map.get(governorate) || [];

      current.push(row);

      map.set(
        governorate,
        current
      );
    }

    return Array.from(map.entries())
      .map(([governorate, supervisors]) => ({
        governorate,
        supervisors,
      }))
      .sort((a, b) =>
        a.governorate.localeCompare(
          b.governorate,
          "ar"
        )
      );
  }, [governorateSupervisorRows]);


  const [
    selectedGovernorate,
    setSelectedGovernorate,
  ] = useState(() => {

    const requested =
      new URLSearchParams(
        window.location.search
      )
        .get("governorate")
        ?.trim() || "";

    const isOfficial =
      OMAN_GOVERNORATES.some(
        (name) =>
          name === requested
      );

    return isOfficial
      ? requested
      : "";
  });

  const [
    guideGovernorateOpen,
    setGuideGovernorateOpen,
  ] = useState(false);


  useEffect(() => {

    const selectedIsOfficial =
      OMAN_GOVERNORATES.some(
        (name) =>
          name === selectedGovernorate
      );

    /*
      إذا جاءت المحافظة من بوابة المحافظة
      وكانت محافظة رسمية، نحافظ عليها حتى لو
      لم يكن لها مشرف مرتبط بعد.
    */
    if (selectedIsOfficial) {
      return;
    }

    if (
      governorateGroups.length === 0
    ) {
      return;
    }

    setSelectedGovernorate(
      governorateGroups[0].governorate
    );

  }, [
    governorateGroups,
    selectedGovernorate,
  ]);


  // OWNER_GOVERNORATE_QUERY_SYNC
  useEffect(() => {

    const isOfficial =
      OMAN_GOVERNORATES.some(
        (name) =>
          name === selectedGovernorate
      );

    if (!isOfficial) {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    if (
      params.get("governorate") ===
      selectedGovernorate
    ) {
      return;
    }

    params.set(
      "governorate",
      selectedGovernorate
    );

    const query =
      params.toString();

    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname +
        (query ? `?${query}` : "") +
        window.location.hash
    );

  }, [
    selectedGovernorate,
  ]);


  const selectedGovernorateGroup =
    governorateGroups.find(
      (item) =>
        item.governorate ===
        selectedGovernorate
    );


  const selectedSupervisors =
    selectedGovernorateGroup?.supervisors || [];


  const [
    selectedSupervisorId,
    setSelectedSupervisorId,
  ] = useState("");


  useEffect(() => {

    if (selectedSupervisors.length === 0) {

      if (selectedSupervisorId) {
        setSelectedSupervisorId("");
      }

      return;
    }


    const stillExists =
      selectedSupervisors.some(
        (row) =>
          row.id === selectedSupervisorId
      );


    if (!stillExists) {
      setSelectedSupervisorId(
        selectedSupervisors[0].id
      );
    }

  }, [
    selectedSupervisors,
    selectedSupervisorId,
  ]);


  const selectedSupervisor =
    selectedSupervisors.find(
      (row) =>
        row.id === selectedSupervisorId
    ) ||
    selectedSupervisors[0];


  const selectedGovernorateActive =
    selectedSupervisors.some(
      (row) => row.enabled !== false
    );



  const canViewGovernorateSupervisor =
    Boolean(
      selectedGovernorate &&
      selectedSupervisors.length > 0
    );


  const selectedSupervisorMatchesGovernorate =
    Boolean(
      selectedSupervisor &&
      String(
        selectedSupervisor.governorate || ""
      ).trim() === selectedGovernorate
    );


  const canEnterGovernoratePortal =
    Boolean(
      selectedGovernorate &&
      selectedSupervisor &&
      selectedSupervisor.enabled !== false &&
      selectedSupervisorMatchesGovernorate
    );


  const focusGovernorateDetails = () => {
    const section =
      document.querySelector(
        '[data-owner-main-cards="governorate-supers"]'
      );

    section?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const openSelectedGovernoratePortal = () => {

    if (!canEnterGovernoratePortal) {
      return;
    }

    navigate(
      `/system/management/governorates/${encodeURIComponent(
        selectedGovernorate
      )}`
    );
  };

  const exportGovernorateSupervisors = () => {

    const csvRows = [
      [
        "المحافظة",
        "الحساب",
        "الحالة",
      ],

      ...governorateSupervisorRows.map(
        (row) => [
          row.governorate || "",
          row.id,
          row.enabled !== false
            ? "مفعل"
            : "موقوف",
        ]
      ),
    ];


    const escapeCsv = (value: unknown) =>
      '"' +
      String(value ?? "")
        .replace(/"/g, '""') +
      '"';


    const csv =
      "\uFEFF" +
      csvRows
        .map((row) =>
          row
            .map(escapeCsv)
            .join(",")
        )
        .join("\r\n");


    const blob = new Blob(
      [csv],
      {
        type:
          "text/csv;charset=utf-8",
      }
    );


    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;

    link.download =
      "governorate-supervisors.csv";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  };


  const authz = useMemo(
    () => buildAuthzSnapshot(auth),
    [auth]
  );

  const owner = isPlatformOwner(authz);

  if (!auth?.user) {
    return <Navigate to="/login" replace />;
  }

  if (!owner) {
    return <Navigate to="/programs-gateway" replace />;
  }

  const sideButtonBase: React.CSSProperties = {
    minWidth: 230,
    height: 52,
    borderRadius: 16,
    fontSize: 18,
    fontWeight: 900,
    cursor: "pointer",
    transition: "all .2s ease",
    border: "1px solid transparent",
    boxShadow: "0 10px 18px rgba(0,0,0,.10), inset 0 1px 0 rgba(255,255,255,.65)",
  };

  return (
    <OwnerDashboardShell
      backTo="/system/management"
      backLabel="العودة إلى الإدارة الرئيسية"
    >
<div
        style={{
          direction: "rtl",
          display: "grid",
          gap: 22,
          padding: "8px 0 20px",
        }}
      >
        <section
          style={{
            background: "transparent",
            border: "none",
            borderRadius: 24,
            padding: "8px 0 0",
            boxShadow: "none",
          }}
        >
          <h1
            style={{
              fontSize: 34,
              fontWeight: 1000,
              color: "#0b6b57",
              margin: "0 0 18px",
              textAlign: "center",
            }}
          >
            إدارة مشرفي المحافظات
          </h1>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "240px 1fr 240px",
              alignItems: "center",
              gap: 24,
              margin: "0 auto",
              maxWidth: 1500,
            }}
          >
            <button
              type="button"
              onClick={() => navigate("/system/owner")}
              style={{
                ...sideButtonBase,
                justifySelf: "end",
                background: "linear-gradient(180deg,#eef4ff 0%, #dce9ff 100%)",
                color: "#1d4ed8",
                borderColor: "#7aa2ff",
                boxShadow: "0 10px 18px rgba(29,78,216,.18), inset 0 1px 0 rgba(255,255,255,.85)",
              }}
            >
              ← العودة إلى لوحة مالك المنصة
            </button>

            <p
              style={{
                margin: 0,
                textAlign: "center",
                fontSize: 18,
                fontWeight: 800,
                color: "#475569",
                lineHeight: 1.9,
              }}
            >
              إدارة وربط مشرفي المحافظات واستعراض بياناتهم والدخول إلى بوابات المحافظات
            </p>

            <button
              type="button"
              onClick={() => navigate("/programs-gateway")}
              style={{
                ...sideButtonBase,
                justifySelf: "start",
                background: "linear-gradient(180deg,#effcf4 0%, #dcf7e7 100%)",
                color: "#15803d",
                borderColor: "#53c483",
                boxShadow: "0 10px 18px rgba(21,128,61,.18), inset 0 1px 0 rgba(255,255,255,.85)",
              }}
            >
              ← العودة إلى البوابة التشغيلية
            </button>
          </div>
        </section>

{/* OWNER_SUPERS_BACK_TO_GOVERNORATE_GATEWAY */}
<div
  style={{
    width: "min(1120px, 100%)",
    margin: "4px auto 14px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    zIndex: 5,
  }}
>
  <button
    type="button"
    disabled={!selectedGovernorate}
    onClick={() => {
      if (!selectedGovernorate) {
        return;
      }

      navigate(
        `/system/management/governorates/${encodeURIComponent(
          selectedGovernorate
        )}`
      );
    }}
    style={{
      minWidth: 290,
      minHeight: 44,
      padding: "0 22px",
      borderRadius: 13,

      border: selectedGovernorate
        ? "1px solid #15803d"
        : "1px solid #cbd5e1",

      borderBottom: selectedGovernorate
        ? "4px solid #166534"
        : "4px solid #94a3b8",

      background: selectedGovernorate
        ? "linear-gradient(180deg,#22a65a,#15803d)"
        : "#e2e8f0",

      color: selectedGovernorate
        ? "#ffffff"
        : "#64748b",

      fontFamily: "inherit",
      fontSize: 13,
      fontWeight: 1000,

      cursor: selectedGovernorate
        ? "pointer"
        : "not-allowed",

      boxShadow: selectedGovernorate
        ? "0 8px 18px rgba(21,128,61,.18)"
        : "none",
    }}
  >
    ← العودة إلى بوابة
    {selectedGovernorate
      ? ` محافظة ${selectedGovernorate}`
      : " المحافظة"}
  </button>
</div>
<section
data-owner-guide="governorate-supers"
style={{
  display:"grid",
  gridTemplateColumns:"repeat(4,minmax(0,1fr))",
  gap:16,
  alignItems:"stretch",
  direction:"rtl",
  background:"transparent",
  padding:0,
  margin:0
}}
>
<OwnerGovernorateGuideStep
    tone="gold"
    icon="📖"
    title="دليل الاستخدام السريع"
    subtitle="خطوات إدارة مشرفي المحافظات والدخول للبوابات"
    onClick={() =>
      navigate("/system/help")
    }
  />


  <div
style={{
  position:"relative",
  minWidth:0
}}
>

  <OwnerGovernorateGuideStep
    tone="green"
    icon="📍"
    title="اختيار المحافظة"
    subtitle={
      selectedGovernorate
        ? `المحافظة المختارة: ${selectedGovernorate}`
        : "من قائمة المحافظات المتاحة"
    }
    showArrow
    arrowOpen={guideGovernorateOpen}
    selected={Boolean(selectedGovernorate)}
    onClick={() =>
      setGuideGovernorateOpen(
        (open) => !open
      )
    }
  />


  {guideGovernorateOpen ? (
    <div
    role="menu"
    style={{
      position:"absolute",
      top:"calc(100% + 8px)",
      right:0,
      left:0,
      zIndex:80,
      padding:8,
      borderRadius:18,
      border:"1px solid #9eddb8",
      background:"rgba(255,255,255,.98)",
      boxShadow:
        "0 18px 38px rgba(15,42,68,.20), inset 0 1px 0 #ffffff",
      backdropFilter:"blur(12px)",
      maxHeight:360,
      overflowY:"auto",
      display:"grid",
      gap:5
    }}
    >

      <div
      style={{
        padding:"7px 10px 9px",
        color:"#087342",
        fontSize:13,
        fontWeight:1000,
        textAlign:"center",
        borderBottom:"1px solid #dcefe4",
        marginBottom:2
      }}
      >
        اختر المحافظة
      </div>


      {OMAN_GOVERNORATES.map(
        (governorate) => {

          const active =
            selectedGovernorate ===
            governorate;

          return (
            <button
              key={governorate}
              type="button"
              role="menuitem"
              onClick={() => {
                setSelectedGovernorate(
                  governorate
                );

                setGuideGovernorateOpen(
                  false
                );
              }}
              style={{
                width:"100%",
                minHeight:40,
                borderRadius:11,
                border:active
                  ? "1px solid #40b779"
                  : "1px solid transparent",
                background:active
                  ? "linear-gradient(180deg,#e8fbf0,#d9f7e6)"
                  : "#ffffff",
                color:active
                  ? "#05683b"
                  : "#18354f",
                fontSize:14,
                fontWeight:active
                  ? 1000
                  : 800,
                fontFamily:"inherit",
                cursor:"pointer",
                padding:"6px 12px",
                display:"flex",
                alignItems:"center",
                justifyContent:"space-between",
                gap:10,
                boxShadow:active
                  ? "0 5px 11px rgba(22,163,74,.12)"
                  : "none"
              }}
            >

              <span>
                {governorate}
              </span>

              <span
              aria-hidden="true"
              style={{
                width:23,
                height:23,
                borderRadius:"50%",
                display:"inline-flex",
                alignItems:"center",
                justifyContent:"center",
                background:active
                  ? "#bdf0d1"
                  : "#eef8f2",
                color:"#07834c",
                fontSize:12,
                fontWeight:1000
              }}
              >
                {active ? "✓" : "›"}
              </span>

            </button>
          );
        }
      )}

    </div>
  ) : null}

</div>


  <OwnerGovernorateGuideStep
    tone="blue"
    icon="👥"
    title="عرض بيانات المشرف"
    subtitle={
      !selectedGovernorate
        ? "اختر المحافظة أولاً"
        : selectedSupervisors.length === 0
          ? "لا يوجد مشرف مرتبط بالمحافظة"
          : "الاطلاع على بيانات المشرفين"
    }
    disabled={
      !canViewGovernorateSupervisor
    }
    selected={
      canViewGovernorateSupervisor
    }
    onClick={
      focusGovernorateDetails
    }
  />


  <OwnerGovernorateGuideStep
    tone="purple"
    icon="🎓"
    title="الدخول إلى بوابة المحافظة"
    subtitle={
      !selectedGovernorate
        ? "اختر المحافظة أولاً"
        : !selectedGovernorateActive
          ? "يتطلب وجود مشرف مفعّل"
          : "الانتقال إلى بوابة المحافظة المختارة"
    }
    disabled={
      !canEnterGovernoratePortal
    }
    selected={
      canEnterGovernoratePortal
    }
    onClick={openSelectedGovernoratePortal}
  />

</section>

<section
data-owner-stats="governorate-supers"
style={{
  width:"min(1120px,100%)",
  margin:"4px auto 0",
  display:"grid",
  gridTemplateColumns:"repeat(3,minmax(0,1fr))",
  gap:28,
  alignItems:"center",
  direction:"rtl"
}}
>

  <div
  style={{
    minHeight:72,
    padding:"8px 20px",
    borderRadius:24,
    border:"1px solid #9cc9fa",
    borderBottom:"4px solid #7fb6ee",
    background:
      "linear-gradient(180deg,rgba(255,255,255,.96) 0%,rgba(230,242,255,.96) 100%)",
    boxShadow:
      "0 12px 22px rgba(30,117,210,.20), inset 0 2px 0 rgba(255,255,255,.95)",
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    gap:14,
    color:"#1262bd"
  }}
  >
    <span
    style={{
      width:48,
      height:48,
      flex:"0 0 48px",
      borderRadius:"50%",
      display:"inline-flex",
      alignItems:"center",
      justifyContent:"center",
      background:
        "linear-gradient(180deg,#ecf6ff 0%,#cfe7ff 100%)",
      boxShadow:
        "0 7px 14px rgba(30,117,210,.20), inset 0 2px 0 #ffffff"
    }}
    >
      <svg
        width="29"
        height="29"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" fill="#1877d2" />
        <path
          d="M7.5 12.2 10.5 15 16.7 8.8"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>

    <strong
    style={{
      fontSize:20,
      fontWeight:1000,
      whiteSpace:"nowrap"
    }}
    >
      الحالات المفعلة: {governorateStats.active}
    </strong>
  </div>


  <div
  style={{
    minHeight:72,
    padding:"8px 20px",
    borderRadius:24,
    border:"1px solid #9edbac",
    borderBottom:"4px solid #76c88a",
    background:
      "linear-gradient(180deg,rgba(255,255,255,.96) 0%,rgba(226,248,229,.96) 100%)",
    boxShadow:
      "0 12px 22px rgba(22,145,65,.20), inset 0 2px 0 rgba(255,255,255,.95)",
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    gap:14,
    color:"#087331"
  }}
  >
    <span
    style={{
      width:48,
      height:48,
      flex:"0 0 48px",
      borderRadius:"50%",
      display:"inline-flex",
      alignItems:"center",
      justifyContent:"center",
      background:
        "linear-gradient(180deg,#edfff1 0%,#ccefd4 100%)",
      boxShadow:
        "0 7px 14px rgba(22,145,65,.20), inset 0 2px 0 #ffffff"
    }}
    >
      <svg
        width="29"
        height="29"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          fill="#078235"
          d="M12 2.7a7 7 0 0 0-7 7c0 5 7 11.6 7 11.6s7-6.6 7-11.6a7 7 0 0 0-7-7Zm0 9.6a2.7 2.7 0 1 1 0-5.4 2.7 2.7 0 0 1 0 5.4Z"
        />
      </svg>
    </span>

    <strong
    style={{
      fontSize:20,
      fontWeight:1000,
      whiteSpace:"nowrap"
    }}
    >
      المحافظات المرتبطة: {governorateStats.governorates}
    </strong>
  </div>


  <div
  style={{
    minHeight:72,
    padding:"8px 20px",
    borderRadius:24,
    border:"1px solid #c8b0f7",
    borderBottom:"4px solid #ad8be8",
    background:
      "linear-gradient(180deg,rgba(255,255,255,.96) 0%,rgba(241,234,255,.96) 100%)",
    boxShadow:
      "0 12px 22px rgba(112,68,198,.20), inset 0 2px 0 rgba(255,255,255,.95)",
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    gap:14,
    color:"#5426a9"
  }}
  >
    <span
    style={{
      width:48,
      height:48,
      flex:"0 0 48px",
      borderRadius:"50%",
      display:"inline-flex",
      alignItems:"center",
      justifyContent:"center",
      background:
        "linear-gradient(180deg,#f8f3ff 0%,#e5d7ff 100%)",
      boxShadow:
        "0 7px 14px rgba(112,68,198,.20), inset 0 2px 0 #ffffff"
    }}
    >
      <svg
        width="31"
        height="31"
        viewBox="0 0 24 24"
        fill="#6b36c9"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="3" />
        <circle cx="16" cy="8" r="3" />
        <circle cx="12" cy="6.5" r="3.2" />
        <path d="M2.8 19c0-3 2.3-5.3 5.2-5.3 1.1 0 2.1.3 3 .9-1.2 1.2-1.9 2.8-1.9 4.4H2.8Z" />
        <path d="M21.2 19c0-3-2.3-5.3-5.2-5.3-1.1 0-2.1.3-3 .9 1.2 1.2 1.9 2.8 1.9 4.4h6.3Z" />
        <path d="M7.5 19.5c0-3.2 2-5.7 4.5-5.7s4.5 2.5 4.5 5.7h-9Z" />
      </svg>
    </span>

    <strong
    style={{
      fontSize:20,
      fontWeight:1000,
      whiteSpace:"nowrap"
    }}
    >
      مشرفو المحافظات المرتبطة: {governorateStats.supervisors}
    </strong>
  </div>

</section>

<section
data-owner-main-cards="governorate-supers"
style={{
  direction:"rtl",
  display:"grid",
  gridTemplateColumns:"0.95fr 1.15fr 1.05fr",
  gap:18,
  alignItems:"stretch",
  marginTop:8
}}
>


{/* =========================
    إجراءات سريعة
========================= */}

<article
style={{
  background:
    "linear-gradient(180deg,rgba(255,255,255,.98),rgba(252,252,249,.97))",
  border:"1px solid #dce3e8",
  borderRadius:22,
  padding:16,
  boxShadow:
    "0 14px 30px rgba(15,42,68,.11), inset 0 2px 0 rgba(255,255,255,.95)",
  display:"flex",
  flexDirection:"column",
  gap:11
}}
>

<div style={{textAlign:"right"}}>
  <h2
  style={{
    margin:0,
    color:"#076747",
    fontSize:23,
    fontWeight:1000
  }}
  >
    إجراءات سريعة
  </h2>

  <div
  style={{
    marginTop:3,
    color:"#64748b",
    fontSize:12,
    fontWeight:800
  }}
  >
    إجراءات شائعة لإدارة مشرفي المحافظات
  </div>
</div>


<button
type="button"
onClick={() =>
  navigate(
    "/system/management/users?addSupervisor=1"
  )
}
style={{
  height:52,
  borderRadius:14,
  border:"1px solid #9cc9fa",
  borderBottom:"4px solid #71a9e8",
  background:
    "linear-gradient(180deg,#f7fbff,#e7f2ff)",
  color:"#174e9b",
  boxShadow:
    "0 7px 14px rgba(37,99,235,.14), inset 0 1px 0 #fff",
  display:"flex",
  alignItems:"center",
  justifyContent:"space-between",
  padding:"0 15px",
  fontSize:15,
  fontWeight:1000,
  cursor:"pointer"
}}
>
  <span>
    إضافة مشرف جديد
  </span>

  <span
  style={{
    width:34,
    height:34,
    borderRadius:"50%",
    display:"inline-flex",
    alignItems:"center",
    justifyContent:"center",
    background:"#dbeafe",
    fontSize:27,
    lineHeight:1
  }}
  >
    +
  </span>
</button>


<button
type="button"
onClick={() =>
  navigate(
    "/system/management/users"
  )
}
style={{
  height:52,
  borderRadius:14,
  border:"1px solid #a0e2ba",
  borderBottom:"4px solid #74c996",
  background:
    "linear-gradient(180deg,#f6fff9,#e7f8ed)",
  color:"#087638",
  boxShadow:
    "0 7px 14px rgba(22,163,74,.13), inset 0 1px 0 #fff",
  display:"flex",
  alignItems:"center",
  justifyContent:"space-between",
  padding:"0 15px",
  fontSize:15,
  fontWeight:1000,
  cursor:"pointer"
}}
>
  <span>
    عرض جميع المشرفين
  </span>

  <span
  style={{
    fontSize:25
  }}
  >
    👥
  </span>
</button>


<button
type="button"
onClick={
  exportGovernorateSupervisors
}
style={{
  height:52,
  borderRadius:14,
  border:"1px solid #edcc8a",
  borderBottom:"4px solid #dbae51",
  background:
    "linear-gradient(180deg,#fffdf7,#fff5de)",
  color:"#96570a",
  boxShadow:
    "0 7px 14px rgba(181,127,22,.13), inset 0 1px 0 #fff",
  display:"flex",
  alignItems:"center",
  justifyContent:"space-between",
  padding:"0 15px",
  fontSize:15,
  fontWeight:1000,
  cursor:"pointer"
}}
>
  <span>
    تصدير البيانات
  </span>

  <span
  style={{
    fontSize:24
  }}
  >
    ▤
  </span>
</button>


<button
type="button"
onClick={() =>
  navigate(
    "/system/help"
  )
}
style={{
  height:52,
  borderRadius:14,
  border:"1px solid #d6bafb",
  borderBottom:"4px solid #b98ce9",
  background:
    "linear-gradient(180deg,#fbf8ff,#f1e9ff)",
  color:"#5426a9",
  boxShadow:
    "0 7px 14px rgba(109,40,217,.12), inset 0 1px 0 #fff",
  display:"flex",
  alignItems:"center",
  justifyContent:"space-between",
  padding:"0 15px",
  fontSize:15,
  fontWeight:1000,
  cursor:"pointer"
}}
>
  <span>
    دليل الاستخدام
  </span>

  <span style={{fontSize:24}}>
    🎓
  </span>
</button>

</article>



{/* =========================
    بيانات المحافظة المختارة
========================= */}

<article
style={{
  background:
    "linear-gradient(180deg,rgba(255,255,255,.99),rgba(250,253,252,.97))",
  border:"1px solid #dce3e8",
  borderRadius:22,
  padding:16,
  boxShadow:
    "0 14px 30px rgba(15,42,68,.11), inset 0 2px 0 rgba(255,255,255,.95)",
  display:"flex",
  flexDirection:"column",
  gap:12
}}
>

<div style={{textAlign:"right"}}>
  <h2
  style={{
    margin:0,
    color:"#076747",
    fontSize:23,
    fontWeight:1000
  }}
  >
    بيانات المحافظة المختارة
  </h2>

  <div
  style={{
    marginTop:3,
    color:"#64748b",
    fontSize:12,
    fontWeight:800
  }}
  >
    تفاصيل المحافظة والمشرفين المرتبطين بها
  </div>
</div>


{selectedGovernorate ? (
<>
<div
style={{
  border:"1px solid #dce4e9",
  borderRadius:17,
  overflow:"hidden",
  boxShadow:
    "0 7px 16px rgba(15,42,68,.07)"
}}
>

<div
style={{
  padding:"11px 14px",
  display:"flex",
  alignItems:"center",
  justifyContent:"space-between",
  background:
    "linear-gradient(135deg,#f8fff9,#fff9eb)"
}}
>

<div
style={{
  display:"flex",
  alignItems:"center",
  gap:10
}}
>
  <span
  style={{
    width:50,
    height:50,
    borderRadius:"50%",
    background:"#e4f8eb",
    display:"inline-flex",
    alignItems:"center",
    justifyContent:"center",
    fontSize:27,
    boxShadow:
      "0 6px 13px rgba(5,150,105,.12)"
  }}
  >
    📍
  </span>

  <strong
  style={{
    fontSize:23,
    color:"#103763",
    fontWeight:1000
  }}
  >
    {selectedGovernorate}
  </strong>
</div>


<span
style={{
  padding:"6px 13px",
  borderRadius:999,
  background:
    selectedGovernorateActive
      ? "#d9fbe6"
      : "#fee2e2",
  border:
    selectedGovernorateActive
      ? "1px solid #84e7ab"
      : "1px solid #fca5a5",
  color:
    selectedGovernorateActive
      ? "#057a38"
      : "#b91c1c",
  fontSize:12,
  fontWeight:1000
}}
>
  {selectedGovernorateActive
    ? "مفعلة"
    : "غير مفعلة"}
</span>

</div>


<div
style={{
  display:"grid",
  gridTemplateColumns:"1fr 1fr",
  fontSize:13,
  fontWeight:900
}}
>

<div
style={{
  padding:9,
  borderTop:"1px solid #e5e7eb",
  borderLeft:"1px solid #e5e7eb"
}}
>
المحافظة
</div>

<div
style={{
  padding:9,
  borderTop:"1px solid #e5e7eb"
}}
>
{selectedGovernorate}
</div>

<div
style={{
  padding:9,
  borderTop:"1px solid #e5e7eb",
  borderLeft:"1px solid #e5e7eb"
}}
>
عدد المشرفين
</div>

<div
style={{
  padding:9,
  borderTop:"1px solid #e5e7eb"
}}
>
{selectedSupervisors.length}
</div>

</div>

</div>


<div>
  <h3
  style={{
    margin:"0 0 3px",
    color:"#08703e",
    fontSize:22,
    fontWeight:1000
  }}
  >
    مشرفو المحافظة
  </h3>

  <div
  style={{
    color:"#64748b",
    fontSize:12,
    fontWeight:800
  }}
  >
    قائمة المشرفين المرتبطين بمحافظة {selectedGovernorate}
  </div>
</div>


{selectedSupervisors.length > 1 ? (

<div
data-owner-supervisor-selector="true"
style={{
  display:"grid",
  gap:7,
  padding:"10px 0 2px"
}}
>

  <div
  style={{
    color:"#475569",
    fontSize:12,
    fontWeight:900
  }}
  >
    اختر المشرف لعرض بياناته
  </div>


  <div
  style={{
    display:"flex",
    flexWrap:"wrap",
    gap:7
  }}
  >

    {selectedSupervisors.map(
      (supervisor, index) => {

        const active =
          selectedSupervisor?.id ===
          supervisor.id;

        return (

          <button
            key={supervisor.id}
            type="button"
            onClick={() =>
              setSelectedSupervisorId(
                supervisor.id
              )
            }
            style={{
              minHeight:36,
              padding:"6px 12px",
              borderRadius:11,

              border:active
                ? "1px solid #5fa6e9"
                : "1px solid #d8e1e8",

              borderBottom:active
                ? "3px solid #2675bd"
                : "3px solid #c6d1da",

              background:active
                ? "linear-gradient(180deg,#eff7ff,#dcecff)"
                : "linear-gradient(180deg,#ffffff,#f6f8fa)",

              color:active
                ? "#15559a"
                : "#475569",

              boxShadow:active
                ? "0 6px 12px rgba(37,99,235,.15)"
                : "0 4px 8px rgba(15,42,68,.07)",

              fontFamily:"inherit",
              fontSize:12,
              fontWeight:1000,
              cursor:"pointer"
            }}
          >
            {supervisor.name ||
              `مشرف ${index + 1}`}
          </button>

        );
      }
    )}

  </div>

</div>

) : null}


{selectedSupervisor ? (
<div
style={{
  border:"1px solid #dce4e9",
  borderRadius:17,
  padding:13,
  boxShadow:
    "0 7px 16px rgba(15,42,68,.07)"
}}
>

<div
style={{
  display:"flex",
  alignItems:"center",
  justifyContent:"space-between",
  gap:12
}}
>

<div
style={{
  display:"flex",
  alignItems:"center",
  gap:11
}}
>

<span
style={{
  width:52,
  height:52,
  flex:"0 0 52px",
  borderRadius:"50%",
  display:"inline-flex",
  alignItems:"center",
  justifyContent:"center",
  background:
    "linear-gradient(180deg,#e5f8ef,#d1efe0)",
  color:"#06734b",
  fontSize:27,
  boxShadow:
    "0 7px 14px rgba(5,150,105,.14)"
}}
>
👤
</span>

<div>
<strong
style={{
  display:"block",
  color:"#15365f",
  fontSize:16,
  fontWeight:1000
}}
>
{selectedSupervisor.name ||
  `مشرف محافظة ${selectedGovernorate}`}
</strong>

<span
style={{
  display:"block",
  marginTop:4,
  color:"#334155",
  fontSize:13,
  fontWeight:800
}}
>
{selectedSupervisor.email ||
  selectedSupervisor.id}
</span>
</div>

</div>


<span
style={{
  padding:"6px 13px",
  borderRadius:999,
  background:
    selectedSupervisor.enabled !== false
      ? "#d9fbe6"
      : "#fee2e2",
  color:
    selectedSupervisor.enabled !== false
      ? "#057a38"
      : "#b91c1c",
  fontSize:12,
  fontWeight:1000
}}
>
{selectedSupervisor.enabled !== false
  ? "مفعلة"
  : "موقوفة"}
</span>

</div>


<div
style={{
  display:"grid",
  gridTemplateColumns:"1fr 1.3fr",
  gap:9,
  marginTop:13
}}
>

<button
type="button"
onClick={() =>
  navigate(
    "/system/management/users?addSupervisor=1"
  )
}
style={{
  height:44,
  borderRadius:11,
  border:"1px solid #d8e0e8",
  background:"#f8fafc",
  color:"#183b66",
  fontWeight:900,
  cursor:"pointer"
}}
>
عرض تفاصيل المشرف
</button>


<button
type="button"
disabled={!canEnterGovernoratePortal}
onClick={openSelectedGovernoratePortal}
style={{
  height:44,
  borderRadius:11,
  border:"1px solid #135ca5",
  borderBottom:"4px solid #073f7c",
  background:
    canEnterGovernoratePortal
      ? "linear-gradient(180deg,#1464ae,#074b91)"
      : "#cbd5e1",
  color:"#ffffff",
  fontWeight:1000,
  cursor:
    canEnterGovernoratePortal
      ? "pointer"
      : "not-allowed",
  boxShadow:
    canEnterGovernoratePortal
      ? "0 8px 15px rgba(7,75,145,.20)"
      : "none"
}}
>
الدخول إلى بوابة المحافظة ←
</button>

</div>

</div>
) : (

<div
style={{
  padding:18,
  borderRadius:15,
  border:"1px dashed #cbd5e1",
  textAlign:"center",
  color:"#64748b",
  fontWeight:900
}}
>
لا يوجد مشرف مرتبط بهذه المحافظة
</div>

)}

</>
) : (

<div
style={{
  padding:25,
  textAlign:"center",
  color:"#64748b",
  fontWeight:900
}}
>
اختر محافظة من القائمة
</div>

)}

</article>



{/* =========================
    قائمة المحافظات
========================= */}

<article
style={{
  background:
    "linear-gradient(180deg,rgba(255,255,255,.99),rgba(250,253,252,.97))",
  border:"1px solid #dce3e8",
  borderRadius:22,
  padding:16,
  boxShadow:
    "0 14px 30px rgba(15,42,68,.11), inset 0 2px 0 rgba(255,255,255,.95)",
  display:"flex",
  flexDirection:"column",
  gap:10
}}
>

<div style={{textAlign:"right"}}>
  <h2
  style={{
    margin:0,
    color:"#076747",
    fontSize:23,
    fontWeight:1000
  }}
  >
    قائمة المحافظات
  </h2>

  <div
  style={{
    marginTop:3,
    color:"#64748b",
    fontSize:12,
    fontWeight:800
  }}
  >
    اختر المحافظة لعرض تفاصيل المشرفين والدخول إلى بوابتها
  </div>
</div>


<div
style={{
  display:"grid",
  gap:8,
  maxHeight:405,
  overflowY:"auto",
  paddingLeft:3
}}
>

{governorateGroups.length === 0 ? (

<div
style={{
  padding:18,
  borderRadius:15,
  border:"1px dashed #cbd5e1",
  textAlign:"center",
  color:"#64748b",
  fontWeight:900
}}
>
لا توجد محافظات مرتبطة بمشرفين حالياً
</div>

) : (

governorateGroups.map((item) => {

  const isSelected =
    item.governorate ===
    selectedGovernorate;

  const isEnabled =
    item.supervisors.some(
      (row) =>
        row.enabled !== false
    );

  return (

<div
key={item.governorate}
style={{
  padding:"9px 11px",
  borderRadius:15,
  border:isSelected
    ? "2px solid #07935c"
    : "1px solid #dce4e9",
  background:isSelected
    ? "linear-gradient(135deg,#effff5,#f7fff9)"
    : "#ffffff",
  boxShadow:isSelected
    ? "0 8px 17px rgba(7,147,92,.14)"
    : "0 4px 10px rgba(15,42,68,.05)",
  display:"grid",
  gridTemplateColumns:"1fr auto",
  alignItems:"center",
  gap:9
}}
>

<div
style={{
  display:"flex",
  alignItems:"center",
  gap:9,
  minWidth:0
}}
>

<span
style={{
  width:42,
  height:42,
  flex:"0 0 42px",
  borderRadius:"50%",
  display:"inline-flex",
  alignItems:"center",
  justifyContent:"center",
  background:"#edf9f2",
  fontSize:23
}}
>
📍
</span>

<div style={{minWidth:0}}>
<strong
style={{
  display:"block",
  color:"#075f3b",
  fontSize:16,
  fontWeight:1000
}}
>
{item.governorate}
</strong>

<span
style={{
  display:"block",
  marginTop:2,
  color:"#475569",
  fontSize:11,
  fontWeight:900
}}
>
مشرفين: {item.supervisors.length}
</span>
</div>


<span
style={{
  padding:"4px 9px",
  borderRadius:999,
  background:isEnabled
    ? "#d9fbe6"
    : "#fee2e2",
  color:isEnabled
    ? "#057a38"
    : "#b91c1c",
  fontSize:10,
  fontWeight:1000,
  whiteSpace:"nowrap"
}}
>
{isEnabled ? "مفعلة" : "موقوفة"}
</span>

</div>


<button
type="button"
onClick={() =>
  setSelectedGovernorate(
    item.governorate
  )
}
style={{
  minWidth:105,
  height:39,
  borderRadius:11,
  border:"1px solid #08734a",
  borderBottom:"4px solid #045733",
  background:
    "linear-gradient(180deg,#07915d,#056d46)",
  color:"#ffffff",
  fontWeight:1000,
  cursor:"pointer",
  boxShadow:
    "0 7px 12px rgba(5,109,70,.16)"
}}
>
عرض المحافظة ←
</button>

</div>

  );
})

)}

</div>

</article>


</section>

<section
data-owner-bottom-links="governorate-supers"
style={{
  direction:"rtl",
  display:"grid",
  gridTemplateColumns:"1fr .72fr 1fr",
  gap:18,
  alignItems:"stretch",
  marginTop:4
}}
>


{/* مراكز الدبلوم */}
<article
style={{
  minHeight:122,
  borderRadius:20,
  border:"1px solid #9edfc8",
  borderBottom:"4px solid #63c7a6",
  background:
    "linear-gradient(135deg,rgba(241,255,249,.98),rgba(231,251,244,.94))",
  boxShadow:
    "0 12px 24px rgba(5,150,105,.15), inset 0 2px 0 rgba(255,255,255,.95)",
  padding:"15px 18px",
  display:"grid",
  gridTemplateColumns:"1fr auto",
  gap:16,
  alignItems:"center"
}}
>

<div>
  <div
  style={{
    display:"flex",
    alignItems:"center",
    gap:10
  }}
  >
    <span
    style={{
      width:38,
      height:38,
      borderRadius:"50%",
      display:"inline-flex",
      alignItems:"center",
      justifyContent:"center",
      background:"#d7f8e9",
      color:"#078457",
      boxShadow:"0 5px 11px rgba(5,150,105,.17)"
    }}
    >
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="5" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="2"/>
        <path d="M9 4v16M15 4v16" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    </span>

    <div>
      <strong
      style={{
        display:"block",
        color:"#08734d",
        fontSize:19,
        fontWeight:1000
      }}
      >
        الانتقال إلى صفحة مراكز الدبلوم
      </strong>

      <span
      style={{
        display:"block",
        marginTop:3,
        color:"#476575",
        fontSize:12,
        fontWeight:800
      }}
      >
        الوصول إلى لوحة إدارة مراكز الدبلوم التابعة للمحافظات
      </span>
    </div>
  </div>

  <button
  type="button"
  onClick={() =>
    navigate("/system/management/diploma-centers")
  }
  style={{
    marginTop:12,
    minWidth:270,
    height:42,
    borderRadius:12,
    border:"1px solid #48b996",
    borderBottom:"4px solid #168867",
    background:
      "linear-gradient(180deg,#eafff6,#d8f7eb)",
    color:"#08724e",
    fontSize:13,
    fontWeight:1000,
    cursor:"pointer",
    boxShadow:
      "0 8px 15px rgba(5,150,105,.17), inset 0 1px 0 #fff"
  }}
  >
    الانتقال إلى إدارة مراكز الدبلوم ←
  </button>
</div>


<div
style={{
  width:112,
  height:72,
  borderRadius:10,
  background:"linear-gradient(180deg,#ffffff,#eaf6f1)",
  border:"2px solid #708090",
  boxShadow:"0 8px 15px rgba(15,42,68,.18)",
  position:"relative",
  display:"flex",
  alignItems:"center",
  justifyContent:"center"
}}
>
  <div
  style={{
    width:"82%",
    height:"66%",
    borderRadius:5,
    background:
      "linear-gradient(135deg,#eef9f5,#d7f1e8)",
    display:"grid",
    gridTemplateColumns:"repeat(3,1fr)",
    gap:4,
    padding:6
  }}
  >
    <span style={{background:"#9bdcc6",borderRadius:3}}></span>
    <span style={{background:"#c8eee1",borderRadius:3}}></span>
    <span style={{background:"#8fd3bc",borderRadius:3}}></span>
    <span style={{background:"#d6f3e9",borderRadius:3}}></span>
    <span style={{background:"#a9e1ce",borderRadius:3}}></span>
    <span style={{background:"#c6ebdf",borderRadius:3}}></span>
  </div>

  <div
  style={{
    position:"absolute",
    width:128,
    height:7,
    background:"#68798a",
    borderRadius:"0 0 7px 7px",
    bottom:-9
  }}
  />
</div>

</article>



{/* الملاحظة الوسطية */}
<article
style={{
  minHeight:122,
  borderRadius:20,
  border:"1px solid #efdca6",
  borderBottom:"4px solid #e0bc62",
  background:
    "linear-gradient(135deg,#fffdf5,#fff7e5)",
  boxShadow:
    "0 12px 24px rgba(181,127,22,.13), inset 0 2px 0 rgba(255,255,255,.95)",
  padding:"16px 18px",
  display:"flex",
  alignItems:"center",
  justifyContent:"center",
  textAlign:"center"
}}
>
  <div>
    <div
    style={{
      fontSize:24,
      marginBottom:5
    }}
    >
      💡
    </div>

    <strong
    style={{
      display:"block",
      color:"#9a6709",
      fontSize:16,
      fontWeight:1000
    }}
    >
      ملاحظة هامة
    </strong>

    <div
    style={{
      marginTop:5,
      color:"#66573a",
      fontSize:12,
      fontWeight:800,
      lineHeight:1.7
    }}
    >
      اختر المحافظة أولاً، ثم استخدم البطاقات للوصول إلى الجهة المطلوبة.
    </div>
  </div>
</article>



{/* المدارس */}
<article
style={{
  minHeight:122,
  borderRadius:20,
  border:"1px solid #a9cdf9",
  borderBottom:"4px solid #74a9e9",
  background:
    "linear-gradient(135deg,rgba(244,250,255,.98),rgba(232,243,255,.95))",
  boxShadow:
    "0 12px 24px rgba(37,99,235,.14), inset 0 2px 0 rgba(255,255,255,.95)",
  padding:"15px 18px",
  display:"grid",
  gridTemplateColumns:"1fr auto",
  gap:16,
  alignItems:"center"
}}
>

<div>
  <div
  style={{
    display:"flex",
    alignItems:"center",
    gap:10
  }}
  >
    <span
    style={{
      width:38,
      height:38,
      borderRadius:"50%",
      display:"inline-flex",
      alignItems:"center",
      justifyContent:"center",
      background:"#deecff",
      color:"#1b68c8",
      boxShadow:"0 5px 11px rgba(37,99,235,.16)"
    }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M3 10.5 12 4l9 6.5-1.2 1.6L12 6.5l-7.8 5.6L3 10.5Z"/>
        <path d="M5 11h14v9H5v-9Zm5 3v6h4v-6h-4Z"/>
      </svg>
    </span>

    <div>
      <strong
      style={{
        display:"block",
        color:"#18599e",
        fontSize:19,
        fontWeight:1000
      }}
      >
        الانتقال إلى صفحة إدارة المدارس
      </strong>

      <span
      style={{
        display:"block",
        marginTop:3,
        color:"#476575",
        fontSize:12,
        fontWeight:800
      }}
      >
        الوصول إلى لوحة إدارة المدارس التابعة للمحافظات
      </span>
    </div>
  </div>

  <button
  type="button"
  onClick={() =>
    navigate("/system/management/schools")
  }
  style={{
    marginTop:12,
    minWidth:270,
    height:42,
    borderRadius:12,
    border:"1px solid #85b8f5",
    borderBottom:"4px solid #4387d7",
    background:
      "linear-gradient(180deg,#f4f9ff,#dfedff)",
    color:"#185aa3",
    fontSize:13,
    fontWeight:1000,
    cursor:"pointer",
    boxShadow:
      "0 8px 15px rgba(37,99,235,.16), inset 0 1px 0 #fff"
  }}
  >
    الانتقال إلى إدارة المدارس ←
  </button>
</div>


<div
style={{
  width:112,
  height:72,
  borderRadius:10,
  background:"linear-gradient(180deg,#ffffff,#edf5ff)",
  border:"2px solid #708090",
  boxShadow:"0 8px 15px rgba(15,42,68,.18)",
  position:"relative",
  display:"flex",
  alignItems:"center",
  justifyContent:"center"
}}
>
  <div
  style={{
    width:"82%",
    height:"66%",
    borderRadius:5,
    background:
      "linear-gradient(135deg,#eef6ff,#d8e9ff)",
    display:"grid",
    gridTemplateColumns:"repeat(3,1fr)",
    gap:4,
    padding:6
  }}
  >
    <span style={{background:"#83b8ef",borderRadius:3}}></span>
    <span style={{background:"#c5ddf8",borderRadius:3}}></span>
    <span style={{background:"#6da8e7",borderRadius:3}}></span>
    <span style={{background:"#d7e8fa",borderRadius:3}}></span>
    <span style={{background:"#97c2ef",borderRadius:3}}></span>
    <span style={{background:"#bcd8f5",borderRadius:3}}></span>
  </div>

  <div
  style={{
    position:"absolute",
    width:128,
    height:7,
    background:"#68798a",
    borderRadius:"0 0 7px 7px",
    bottom:-9
  }}
  />
</div>

</article>

</section>



      </div>
    </OwnerDashboardShell>
  );
}









