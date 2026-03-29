// src/App.tsx
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import Layout from "./layout/Layout";
import { ProtectedRoute, SuperAdminRoute, TenantRoute, SystemRoute, SuperRoute } from "./auth/ProtectedRoute";

import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";

import Dashboard from "./pages/Dashboard";
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
import Gallery from "./pages/Gallery";
import About from "./pages/About";
import TeamMembers from "./pages/TeamMembers";
import DistributionVersions from "./pages/DistributionVersions";
import AdminSystem from "./pages/AdminSystem";
import SuperSystem from "./pages/SuperSystem";
import SuperGovernorates from "./pages/SuperGovernorates";
import Migrate from "./pages/Migrate";
import Analytics1Page from "./pages/Analytics1Page";
import AnalyticsPage from "./pages/AnalyticsPage";
import VersioningPage from "./pages/VersioningPage";
import MultiRolePage from "./pages/MultiRolePage";
import { useI18n } from "./i18n/I18nProvider";
import LegacyTenantRedirect from "./pages/LegacyTenantRedirect";
import { LEGACY_TENANT_PATHS } from "./config/tenantRoutes";

// Root redirect (split: SuperAdmin vs Super)
import RootRedirect from "./pages/RootRedirect";
import SuperPortal from "./pages/SuperPortal";
import SuperProgramEnter from "./pages/SuperProgramEnter";

export default function App() {
  const [loading, setLoading] = useState(true);
  const { lang } = useI18n();
  const tr = (ar: string, en: string) => (lang === "ar" ? ar : en);

  useEffect(() => {
    // التأكد من حالة المستخدم قبل التفاعل مع الصفحة
    setTimeout(() => setLoading(false), 1000); // فترة تحميل مؤقتة لتفادي التوجيه السريع.
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
        path="/system/supers"
        element={
          <SuperAdminRoute>
            <SuperGovernorates />
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
        <Route index element={<Dashboard />} />

        {/* Task Distribution */}
        <Route path="task-distribution" element={<Navigate to="run" replace />} />
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
        <Route path="gallery" element={<Gallery />} />
        <Route path="about" element={<About />} />

        {/* Admin (in this project: owner/admin only) */}
        <Route path="archive" element={<Archive />} />
        <Route path="audit" element={<Audit />} />
        <Route path="activity-logs" element={<ActivityLogs />} />
        <Route path="sync" element={<Sync />} />
        <Route path="analytics1" element={<Analytics1Page />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="versioning" element={<VersioningPage />} />
        <Route path="multi-role" element={<MultiRolePage />} />

      </Route>

      {LEGACY_TENANT_PATHS.map((legacyPath) => (
        <Route key={legacyPath} path={`/${legacyPath}`} element={<ProtectedRoute><LegacyTenantRedirect /></ProtectedRoute>} />
      ))}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}