// src/App.tsx
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";

import Layout from "./layout/Layout";
import Layout12 from "./layout/Layout12";
import { ProtectedRoute, SuperAdminRoute, TenantRoute, SuperRoute } from "./auth/ProtectedRoute";
import { useAuth } from "./auth/AuthContext";

import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";

import Dashboard from "./pages/Dashboard";
import Dashboard12 from "./pages/Dashboard12";
import Teachers12 from "./pages/Teachers12";
import Exams12 from "./pages/Exams12";
import Rooms12 from "./pages/Rooms12";
import Settings12 from "./pages/Settings12";
import Setting12 from "./pages/Setting12";
import Unavailability12 from "./pages/Unavailability12";
import TaskDistributionRun12 from "./pages/TaskDistributionRun12";
import TaskDistributionResults12 from "./pages/TaskDistributionResults12";
import TaskDistributionPrint12 from "./pages/TaskDistributionPrint12";
import Analytics12Page from "./pages/Analytics12Page";
import Control12 from "./pages/Control12";
import About12 from "./pages/About12";
import Suggestions12Page from "./pages/Suggestions12Page";
import StudentSeatRegister12Page from "./pages/StudentSeatRegister12Page";
import Teachers from "./pages/Teachers";
import Exams from "./pages/Exams";
import Rooms from "./pages/Rooms";
import RoomBlocks from "./pages/RoomBlocks";

// ✅ Task Distribution
import TaskDistributionRun from "./pages/TaskDistributionRun";
import TaskDistributionResults from "./pages/TaskDistributionResults";
import TaskDistributionPrint from "./pages/TaskDistributionPrint";
import TaskDistributionSuggestions from "./pages/TaskDistributionSuggestions";

import Report from "./pages/Report";
import RunDetails from "./pages/RunDetails";
import Archive from "./pages/Archive";
import Audit from "./pages/Audit";
import ActivityLogs from "./pages/ActivityLogs";
import Sync from "./pages/Sync";
import Unavailability from "./pages/Unavailability";
import Settings from "./pages/Settings";
import Settings1 from "./pages/Settings1";
import SuggestionsPage from "./pages/SuggestionsPage";
import Gallery from "./pages/Gallery";
import About from "./pages/About";
import TeamMembers from "./pages/TeamMembers";
import DistributionVersions from "./pages/DistributionVersions";
import AdminSystem from "./pages/AdminSystem";
import SuperSystem from "./pages/SuperSystem";
import SuperGovernorates from "./pages/SuperGovernorates";
import AdminSupersPage from "./pages/AdminSupersPage";
import Migrate from "./pages/Migrate";
import AnalyticsPage from "./pages/AnalyticsPage";
import Analytics1Page from "./pages/Analytics1Page";
import VersioningPage from "./pages/VersioningPage";
import MultiRolePage from "./pages/MultiRolePage";
import { useI18n } from "./i18n/I18nProvider";
import LegacyTenantRedirect from "./pages/LegacyTenantRedirect";
import { LEGACY_TENANT_PATHS } from "./config/tenantRoutes";
import SuperSuggestions from "./pages/SuperSuggestions";
import GovernorateTenantsManager from "./pages/GovernorateTenantsManager";

// Root redirect (split: SuperAdmin vs Super)
import RootRedirect from "./pages/RootRedirect";
import SuperPortal from "./pages/SuperPortal";
import SuperProgramEnter from "./pages/SuperProgramEnter";
import ProgramsGateway from "./pages/ProgramsGateway";
import SchoolAdminsDirectory from "./pages/SchoolAdminsDirectory";
import GovernorateSupersDirectory from "./pages/GovernorateSupersDirectory";
import PlatformGovernorateSupersDirectory from "./pages/PlatformGovernorateSupersDirectory";
import { db } from "./firebase/firebase";
import { doc, getDoc } from "firebase/firestore";



function TenantIndexRedirect() {
  const auth = useAuth() as any;
  const { tenantId } = useParams();
  const [tenantType, setTenantType] = useState("");
  const [tenantTypeLoading, setTenantTypeLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadTenantType() {
      const id = String(tenantId || "").trim();
      if (!id) {
        if (mounted) {
          setTenantType("");
          setTenantTypeLoading(false);
        }
        return;
      }

      try {
        const rootSnap = await getDoc(doc(db, "tenants", id));
        const rootType = String(rootSnap.data()?.type || "").trim();

        if (rootType) {
          if (mounted) {
            setTenantType(rootType);
            setTenantTypeLoading(false);
          }
          return;
        }

        const configSnap = await getDoc(doc(db, "tenants", id, "meta", "config"));
        const configType = String(configSnap.data()?.type || "").trim();

        if (mounted) {
          setTenantType(configType);
          setTenantTypeLoading(false);
        }
      } catch {
        if (mounted) {
          setTenantType("");
          setTenantTypeLoading(false);
        }
      }
    }

    void loadTenantType();

    return () => {
      mounted = false;
    };
  }, [tenantId]);

  if (auth?.loading || tenantTypeLoading) return null;

  const role = String(
    auth?.effectiveRole ||
    auth?.allow?.role ||
    auth?.profile?.role ||
    auth?.userProfile?.role ||
    ""
  ).trim().toLowerCase();

  const linkedTenantId = String(
    auth?.effectiveTenantId ||
    auth?.allow?.tenantId ||
    auth?.profile?.tenantId ||
    auth?.userProfile?.tenantId ||
    ""
  ).trim();

  const isExamCenterTenant = String(tenantType || "").trim().toLowerCase() === "exam_center";

  if (role === "exam_super" && tenantId && linkedTenantId === String(tenantId).trim() && isExamCenterTenant) {
    return <Navigate to="dashboard12" replace />;
  }

  return <Dashboard />;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  useEffect(() => {
    setTimeout(() => setLoading(false), 1000);
  }, []);

  if (loading) {
    return <div style={{ padding: 24, color: "#d4af37", background: "#020617", minHeight: "100vh" }}>{tr("جاري التحميل...", "Loading...")}</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Super Admin official portal */}
      <Route
        path="/super"
        element={
          <SuperAdminRoute>
            <SuperPortal />
          </SuperAdminRoute>
        }
      />
      <Route
        path="/super/program"
        element={
          <SuperAdminRoute>
            <SuperProgramEnter />
          </SuperAdminRoute>
        }
      />

      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />

      {/* Root: send user to correct area */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RootRedirect />
          </ProtectedRoute>
        }
      />


      <Route
        path="/programs-gateway"
        element={
          <ProtectedRoute>
            <ProgramsGateway />
          </ProtectedRoute>
        }
      />

      <Route
        path="/school-admins"
        element={
          <ProtectedRoute>
            <SchoolAdminsDirectory />
          </ProtectedRoute>
        }
      />

      <Route
        path="/governorate-supers"
        element={
          <ProtectedRoute>
            <GovernorateSupersDirectory />
          </ProtectedRoute>
        }
      />

      {/* =========================
          Super Admin System Area
         ========================= */}
      <Route
        path="/system"
        element={
          <SuperAdminRoute>
            <AdminSystem />
          </SuperAdminRoute>
        }
      />

      {/* =========================
          Super (Governorate) Area
         ========================= */}
      <Route
        path="/super-system"
        element={
          <SuperRoute>
            <SuperSystem />
          </SuperRoute>
        }
      />

      <Route
        path="/platform-super-system"
        element={
          <SuperAdminRoute>
            <SuperSystem />
          </SuperAdminRoute>
        }
      />

      <Route
        path="/platform-governorate-supers"
        element={
          <SuperAdminRoute>
            <PlatformGovernorateSupersDirectory />
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/supers"
        element={
          <SuperAdminRoute>
            <SuperGovernorates />
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/add-supers"
        element={
          <SuperAdminRoute>
            <AdminSupersPage />
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/migrate"
        element={
          <SuperAdminRoute>
            <Migrate />
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/governorate-tenants"
        element={
          <SuperAdminRoute>
            <GovernorateTenantsManager />
          </SuperAdminRoute>
        }
      />

      <Route
        path="/super/suggestions"
        element={
         <SuperAdminRoute>
         <SuperSuggestions />
         </SuperAdminRoute>
        }
      />

      {/* =========================
          Tenant Area (School)
         ========================= */}
      <Route
        path="/t/:tenantId"
        element={
          <TenantRoute>
            <Layout />
          </TenantRoute>
        }
      >
        <Route index element={<TenantIndexRedirect />} />
        <Route path="dashboard" element={<Dashboard />} />

        {/* Task Distribution */}
        <Route path="task-distribution" element={<Navigate to="run" replace />} />
        <Route path="distribution" element={<Navigate to="task-distribution/run" replace />} />
        <Route path="distribution/full-table" element={<Navigate to="task-distribution/results" replace />} />
        <Route path="TaskDistributionRun" element={<Navigate to="task-distribution/run" replace />} />
        <Route path="TaskDistributionResults" element={<Navigate to="task-distribution/results" replace />} />
        <Route path="task-distribution/run" element={<TaskDistributionRun />} />
        <Route path="task-distribution/results" element={<TaskDistributionResults />} />
        <Route path="task-distribution/versions" element={<DistributionVersions />} />
        <Route path="task-distribution/print" element={<TaskDistributionPrint />} />
        <Route path="task-distribution/suggestions" element={<TaskDistributionSuggestions />} />

        <Route path="run-details" element={<RunDetails />} />
        <Route path="teachers" element={<Teachers />} />
        <Route path="team-members" element={<TeamMembers />} />
        <Route path="exams" element={<Exams />} />
        <Route path="rooms" element={<Rooms />} />
        <Route path="room-blocks" element={<RoomBlocks />} />

        <Route path="report" element={<Report />} />
        <Route path="unavailability" element={<Unavailability />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings1" element={<Settings1 />} />
        <Route path="suggestions" element={<SuggestionsPage />} />
        <Route path="gallery" element={<Gallery />} />
        <Route path="about" element={<About />} />

        {/* Admin */}
        <Route path="archive" element={<Archive />} />
        <Route path="audit" element={<Audit />} />
        <Route path="activity-logs" element={<ActivityLogs />} />
        <Route path="sync" element={<Sync />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="analytics1" element={<Analytics1Page />} />
        <Route path="versioning" element={<VersioningPage />} />
        <Route path="multi-role" element={<MultiRolePage />} />
      </Route>

      {/* =========================
          Tenant Area (Exam Center / Diploma)
         ========================= */}
      <Route
        path="/t/:tenantId"
        element={
          <TenantRoute>
            <Layout12 />
          </TenantRoute>
        }
      >
        <Route path="dashboard12" element={<Dashboard12 />} />
        <Route path="settings12" element={<Settings12 />} />
        <Route path="teachers12" element={<Teachers12 />} />
        <Route path="rooms12" element={<Rooms12 />} />
        <Route path="exams12" element={<Exams12 />} />
        <Route path="unavailability12" element={<Unavailability12 />} />
        <Route path="task-distribution-run12" element={<TaskDistributionRun12 />} />
        <Route path="task-distribution-results12" element={<TaskDistributionResults12 />} />
        <Route path="setting12" element={<Setting12 />} />
        <Route path="task-distribution-print12" element={<TaskDistributionPrint12 />} />
        <Route path="analytics12" element={<Analytics12Page />} />
        <Route path="control12" element={<Control12 />} />
        <Route path="student-seat-register12" element={<StudentSeatRegister12Page />} />
        <Route path="suggestions12page" element={<Suggestions12Page />} />
        <Route path="about12" element={<About12 />} />
      </Route>

      {LEGACY_TENANT_PATHS.map((legacyPath) => (
        <Route key={legacyPath} path={`/${legacyPath}`} element={<ProtectedRoute><LegacyTenantRedirect /></ProtectedRoute>} />
      ))}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
