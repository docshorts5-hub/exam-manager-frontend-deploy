// src/App.tsx
import React, { useEffect, useState } from "react";
import { Routes, Route, Navigate, useParams } from "react-router-dom";

import Layout from "./layout/Layout";
import Layout12 from "./layout/Layout12";
import { ProtectedRoute, SuperAdminRoute, TenantRoute, SuperRoute } from "./auth/ProtectedRoute";
import SuperAdminEmailGateRoute from "./auth/SuperAdminEmailGateRoute";
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
import CandidateViolationReportForm12 from "./pages/CandidateViolationReportForm12";
import CandidateWrittenWarning12 from "./pages/CandidateWrittenWarning12";
import About12 from "./pages/About12";
import Suggestions12Page from "./pages/Suggestions12Page";
import StudentSeatRegister12Page from "./pages/StudentSeatRegister12Page";
import ChangePhoneRequest from "./pages/ChangePhoneRequest";
import Teachers from "./pages/Teachers";
import Exams from "./pages/Exams";
import Rooms from "./pages/Rooms";
import RoomBlocks from "./pages/RoomBlocks";

// أ¢إ“â€¦ Task Distribution
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
import Sync12 from "./pages/Sync12";
import Unavailability from "./pages/Unavailability";
import Settings from "./pages/Settings";
import Settings1 from "./pages/Settings1";
import SuggestionsPage from "./pages/SuggestionsPage";
import Gallery from "./pages/Gallery";
import About from "./pages/About";
import TeamMembers from "./pages/TeamMembers";
import DistributionVersions from "./pages/DistributionVersions";
import AdminSystem from "./pages/AdminSystem";
import DeletedSchoolTenants from "./pages/DeletedSchoolTenants";
import OwnerDashboardHome from "./pages/owner/OwnerDashboardHome";
import OwnerGovernorateSupersManagement from "./pages/owner/OwnerGovernorateSupersManagement";
import OwnerDashboardSection from "./pages/owner/OwnerDashboardSection";
import OwnerDashboardHelp from "./pages/owner/OwnerDashboardHelp";
import OwnerGovernoratesPage from "./pages/owner/OwnerGovernoratesPage";
import OwnerGovernorateGateway from "./pages/owner/OwnerGovernorateGateway";

import OwnerSchoolsPage from "./pages/owner/OwnerSchoolsPage";
import OwnerSchoolsGovernoratePage from "./pages/owner/OwnerSchoolsGovernoratePage";
import OwnerDiplomaCentersPage from "./pages/owner/OwnerDiplomaCentersPage";
import OwnerDiplomaCentersGovernoratePage from "./pages/owner/OwnerDiplomaCentersGovernoratePage";
import OwnerUsersPage from "./pages/owner/users/OwnerUsersPage";
import OwnerDeletedDiplomaCentersPage from "./pages/owner/OwnerDeletedDiplomaCentersPage";
import SuperSystem from "./pages/SuperSystem";
import GovernorateAwareSuperSystem from "./pages/GovernorateAwareSuperSystem";
import GovernorateSchoolsManagementModel3 from "./pages/GovernorateSchoolsManagementModel3";
import TotpResetAdminPage from "./pages/TotpResetAdminPage";
import AddSchoolAdminByGovernorate from "./pages/AddSchoolAdminByGovernorate";
import AddExamSuper12 from "./pages/AddExamSuper12";
import SuperGovernorates from "./pages/SuperGovernorates";
import AdminSupersPage from "./pages/AdminSupersPage";
import Migrate from "./pages/Migrate";
import AnalyticsPage from "./pages/AnalyticsPage";
import Analytics1Page from "./pages/Analytics1Page";
import VersioningPage from "./pages/VersioningPage";
import MultiRolePage from "./pages/MultiRolePage";
import LegacyTenantRedirect from "./pages/LegacyTenantRedirect";
import { LEGACY_TENANT_PATHS } from "./config/tenantRoutes";
import SuperSuggestions from "./pages/SuperSuggestions";
import GovernorateTenantsManager from "./pages/GovernorateTenantsManager";
import CloudStorageHealth from "./pages/CloudStorageHealth";
import CloudStorageHealth12 from "./pages/CloudStorageHealth12";
import CloudBackup from "./pages/CloudBackup";
import CloudBackup12 from "./pages/CloudBackup12";
import PermissionsAudit from "./pages/PermissionsAudit";
import CommercialReadiness from "./pages/CommercialReadiness";
import SystemAuditLog from "./pages/SystemAuditLog";
import SystemErrorLog from "./pages/SystemErrorLog";
import SystemMonitoringDashboard from "./pages/SystemMonitoringDashboard";
import MinistryGovernorateGateway from "./pages/ministry/MinistryGovernorateGateway";
import MinistryGovernorateSchools from "./pages/ministry/MinistryGovernorateSchools";
import MinistryTenantReturnBar from "./pages/ministry/MinistryTenantReturnBar";
import MinistryDiplomaCenters from "./pages/ministry/MinistryDiplomaCenters";
import MinistryGovernorateExamSupers from "./pages/ministry/MinistryGovernorateExamSupers";
import SystemMaintenanceCenter from "./pages/SystemMaintenanceCenter";
import SystemReleaseCenter from "./pages/SystemReleaseCenter";
import SystemCommercialTestSuite from "./pages/SystemCommercialTestSuite";
import GovernorateSuperModel3Preview from "./pages/GovernorateSuperModel3Preview";

// Root redirect (split: SuperAdmin vs Super)
import RootRedirect from "./pages/RootRedirect";
import SuperPortal from "./pages/SuperPortal";
import MinistryAwareSuperPortal from "./pages/ministry/MinistryAwareSuperPortal";
import SuperProgramEnter from "./pages/SuperProgramEnter";
import ProgramsGateway from "./pages/ProgramsGateway";
import SchoolAdminsDirectory from "./pages/SchoolAdminsDirectory";
import ExamSupersDirectory from "./pages/ExamSupersDirectory";
import GovernorateSupersDirectory from "./pages/GovernorateSupersDirectory";
import PlatformGovernorateSupersDirectory from "./pages/PlatformGovernorateSupersDirectory";
import { db } from "./firebase/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useTenantCloudLocalStorageBridge } from "./features/cloud-storage/useTenantCloudLocalStorageBridge";
import ReadOnlyTenantMutationGuard from "./features/readonly/ReadOnlyTenantMutationGuard";
import AuditTrailAgent from "./features/audit/AuditTrailAgent";
import ErrorMonitorAgent from "./features/diagnostics/ErrorMonitorAgent";



function safeStorageValue(key: string): string {
  if (typeof window === "undefined") return "";

  try {
    return String(window.sessionStorage?.getItem(key) || window.localStorage?.getItem(key) || "").trim();
  } catch {
    return "";
  }
}

function clearReadOnlyViewStorageFromApp(): void {
  if (typeof window === "undefined") return;

  const keys = [
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
  ];

  for (const key of keys) {
    try { window.sessionStorage.removeItem(key); } catch {}
    try { window.localStorage.removeItem(key); } catch {}
  }
}

function isReadOnlyViewForTenant(tenantId: string): boolean {
  const targetTenantId = String(tenantId || "").trim();
  if (!targetTenantId) return false;

  const expiresAt = Number(safeStorageValue("governorateSuperViewExpiresAt") || 0);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;

  const hasReadOnlyFlag = [
    safeStorageValue("governorateSuperReadOnly"),
    safeStorageValue("viewAsReadOnly"),
    safeStorageValue("readOnly"),
  ].some((value) => ["1", "true", "yes"].includes(value.toLowerCase()));

  if (!hasReadOnlyFlag) return false;

  return [
    safeStorageValue("governorateSuperViewTenantId"),
    safeStorageValue("viewAsTenantId"),
    safeStorageValue("effectiveTenantId"),
    safeStorageValue("selectedTenantId"),
    safeStorageValue("tenantId"),
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .includes(targetTenantId);
}

type TenantCloudStorageBridgeGateProps = {
  children: React.ReactNode;
};

function TenantCloudStorageBridgeGate({ children }: TenantCloudStorageBridgeGateProps) {
  const { tenantId } = useParams();
  const auth = useAuth() as any;
  const readOnly = Boolean(
    auth?.readOnly ||
    auth?.allow?.readOnly ||
    auth?.profile?.readOnly ||
    auth?.userProfile?.readOnly ||
    isReadOnlyViewForTenant(String(tenantId || "").trim())
  );

  const currentRoleForReadOnlyBanner = String(
    auth?.effectiveRole ||
    auth?.allow?.role ||
    auth?.profile?.role ||
    auth?.userProfile?.role ||
    ""
  ).trim().toLowerCase();

  const showGovernorateReadOnlyReturnButton = Boolean(
    readOnly &&
    !auth?.isPlatformOwner &&
    (auth?.isSuper || currentRoleForReadOnlyBanner === "super")
  );

  const governorateReadOnlyReturnPath =
    safeStorageValue("readOnlyReturnTo") ||
    safeStorageValue("governorateSuperReturnTo") ||
    "/school-admins";

  const handleGovernorateReadOnlyReturn = () => {
    clearReadOnlyViewStorageFromApp();
    window.location.assign(governorateReadOnlyReturnPath);
  };

  // ط·ع¾ط·آ´ط·ط›ط¸ظ¹ط¸â€‍ ط·آ§ط¸â€‍ط·ع¾ط·آ®ط·آ²ط¸ظ¹ط¸â€  ط·آ§ط¸â€‍ط·آ³ط·آ­ط·آ§ط·آ¨ط¸ظ¹ ط¸ظ¾ط¸ظ¹ ط·آ§ط¸â€‍ط·آ®ط¸â€‍ط¸ظ¾ط¸ظ¹ط·آ© ط¸ظ¾ط¸â€ڑط·آ·.
  // ط¸â€‍ط·آ§ ط¸â€ ط¸ث†ط¸â€ڑط¸ظ¾ ط¸ظ¾ط·ع¾ط·آ­ ط·آ§ط¸â€‍ط·آµط¸ظ¾ط·آ­ط·آ§ط·ع¾ ط·آ¥ط·آ°ط·آ§ ط¸ئ’ط·آ§ط¸â€  ط·آ§ط¸â€‍ط·آ§ط·ع¾ط·آµط·آ§ط¸â€‍ ط·آ¨ط·آ§ط¸â€‍ط·آ³ط·آ­ط·آ§ط·آ¨ط·آ© ط·آ¨ط·آ·ط¸ظ¹ط·آ¦ط¸â€¹ط·آ§ ط·آ£ط¸ث† ط·ط›ط¸ظ¹ط·آ± ط¸â€¦ط·آ³ط·ع¾ط¸â€ڑط·آ±.
  useTenantCloudLocalStorageBridge({
    tenantId: String(tenantId || "").trim(),
    readOnly,
  });

  return (
    <ReadOnlyTenantMutationGuard active={readOnly}>
      
        <MinistryTenantReturnBar />
        {children}
    </ReadOnlyTenantMutationGuard>
  );
}


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
  return (
    <>
      <AuditTrailAgent />
      <ErrorMonitorAgent />
      <Routes>
      <Route path="/login" element={<Login />} />

      {/* Super Admin official portal */}
      <Route
        path="/super"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
            <MinistryAwareSuperPortal />
          </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />
      <Route
        path="/super/program"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
            <SuperProgramEnter />
          </SuperAdminEmailGateRoute>
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
        path="/exam-supers"
        element={
          <ProtectedRoute>
            <ExamSupersDirectory />
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
            <SuperAdminEmailGateRoute>
              <OwnerDashboardHome />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/management"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <OwnerDashboardSection section="management" />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />


      <Route

        path="/system/management/governorates"

        element={

          <SuperAdminRoute>

            <SuperAdminEmailGateRoute>

              <OwnerGovernoratesPage />

            </SuperAdminEmailGateRoute>

          </SuperAdminRoute>

        }

      />



      <Route

        path="/system/management/governorates/:governorateId"

        element={

          <SuperAdminRoute>

            <SuperAdminEmailGateRoute>

              <OwnerGovernorateGateway />

            </SuperAdminEmailGateRoute>

          </SuperAdminRoute>

        }

      />

      <Route
        path="/system/management/schools"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <OwnerSchoolsPage />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      
      <Route
        path="/system/management/schools/deleted"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <DeletedSchoolTenants />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />
<Route
        path="/system/management/schools/:governorateId"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <OwnerSchoolsGovernoratePage />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/management/diploma-centers"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <OwnerDiplomaCentersPage />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/management/diploma-centers/deleted"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <OwnerDeletedDiplomaCentersPage />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/management/diploma-centers/:governorateId"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <OwnerDiplomaCentersGovernoratePage />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/management/users"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <OwnerUsersPage />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/security"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <OwnerDashboardSection section="security" />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/operations"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <OwnerDashboardSection section="operations" />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/help"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <OwnerDashboardHelp />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/legacy"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <AdminSystem />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      {/* =========================
          Super (Governorate) Area
         ========================= */}
      <Route
        path="/super-system/schools-management"
        element={
          <SuperRoute>
            <GovernorateSchoolsManagementModel3 />
          </SuperRoute>
        }
      />

      <Route
        path="/super-system"
        element={
          <SuperRoute>
            <GovernorateAwareSuperSystem />
          </SuperRoute>
        }
      />

      <Route
        path="/security/totp-reset"
        element={
          <SuperRoute>
            <TotpResetAdminPage />
          </SuperRoute>
        }
      />



      <Route
        path="/super-system/model3"
        element={
          <SuperRoute>
            <GovernorateSuperModel3Preview />
          </SuperRoute>
        }
      />

      <Route
        path="/super-system/governorate/:governorateId"
        element={
          <SuperRoute>
            <MinistryGovernorateGateway />
          </SuperRoute>
        }
      />

      <Route
        path="/super-system/governorate/:governorateId/schools"
        element={
          <SuperRoute>
            <MinistryGovernorateSchools />
          </SuperRoute>
        }
      />

      <Route
        path="/super-system/governorate/:governorateId/exam-supers"
        element={
          <SuperRoute>
            <MinistryGovernorateExamSupers />
          </SuperRoute>
        }
      />

      <Route
        path="/super-system/governorate/:governorateId/exam-supers/:examSuperId/centers"
        element={
          <SuperRoute>
            <MinistryDiplomaCenters />
          </SuperRoute>
        }
      />

      <Route
        path="/platform-super-system"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
            <SuperSystem />
          </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />


      <Route
        path="/super-system/add-school-admin"
        element={
          <SuperRoute>
            <AddSchoolAdminByGovernorate />
          </SuperRoute>
        }
      />

      <Route
        path="/platform-super-system/add-school-admin"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
            <AddSchoolAdminByGovernorate />
          </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/add-school-admin"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
            <AddSchoolAdminByGovernorate />
          </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />


      <Route
        path="/super-system/add-exam-super12"
        element={
          <SuperRoute>
            <AddExamSuper12 />
          </SuperRoute>
        }
      />

      <Route
        path="/platform-super-system/add-exam-super12"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
            <AddExamSuper12 />
          </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/add-exam-super12"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
            <AddExamSuper12 />
          </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/platform-governorate-supers"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
            <OwnerGovernorateSupersManagement />
          </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/supers"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
            <SuperGovernorates />
          </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/add-supers"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <AdminSupersPage />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/migrate"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
            <Migrate />
          </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/permissions-audit"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <PermissionsAudit />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/commercial-readiness"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <CommercialReadiness />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/audit-log"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <SystemAuditLog />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/error-log"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <SystemErrorLog />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/monitoring"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <SystemMonitoringDashboard />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/maintenance"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <SystemMaintenanceCenter />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/release-center"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <SystemReleaseCenter />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/commercial-test-suite"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
              <SystemCommercialTestSuite />
            </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/system/governorate-tenants"
        element={
          <SuperAdminRoute>
            <SuperAdminEmailGateRoute>
            <GovernorateTenantsManager />
          </SuperAdminEmailGateRoute>
          </SuperAdminRoute>
        }
      />

      <Route
        path="/super/suggestions"
        element={
         <SuperAdminRoute>
         <SuperAdminEmailGateRoute>
            <SuperSuggestions />
          </SuperAdminEmailGateRoute>
         </SuperAdminRoute>
        }
      />

      {/* ط·آµط¸ظ¾ط·آ­ط·آ© ط·ع¾ط·ط›ط¸ظ¹ط¸ظ¹ط·آ± ط·آ±ط¸â€ڑط¸â€¦ ط·آ§ط¸â€‍ط¸â€،ط·آ§ط·ع¾ط¸ظ¾ ط¸â€¦ط¸â€  ط·آ±ط·آ§ط·آ¨ط·آ· ط·آ§ط¸â€‍ط·آ¨ط·آ±ط¸ظ¹ط·آ¯ - ط¸â€¦ط·آ³ط·ع¾ط¸â€ڑط¸â€‍ط·آ© ط·آ¹ط¸â€  Layout ط·آ§ط¸â€‍ط¸â€¦ط·آ¯ط·آ±ط·آ³ط·آ© ط¸ث†ط·آ§ط¸â€‍ط·آ¯ط·آ¨ط¸â€‍ط¸ث†ط¸â€¦ */}
      <Route
        path="/t/:tenantId/change-phone"
        element={
          <TenantRoute>
            <ChangePhoneRequest />
          </TenantRoute>
        }
      />

      {/* =========================
          Tenant Area (School)
         ========================= */}
      <Route
        path="/t/:tenantId"
        element={
          <TenantRoute>
            <TenantCloudStorageBridgeGate>
              <Layout />
            </TenantCloudStorageBridgeGate>
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
        <Route path="cloud-health" element={<CloudStorageHealth />} />
        <Route path="cloud-backup" element={<CloudBackup />} />
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
            <TenantCloudStorageBridgeGate>
              <Layout12 />
            </TenantCloudStorageBridgeGate>
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
        <Route path="candidate-violation-report12" element={<CandidateViolationReportForm12 />} />
        <Route path="candidate-written-warning12" element={<CandidateWrittenWarning12 />} />
        <Route path="student-seat-register12" element={<StudentSeatRegister12Page />} />
        {/* ط¸â€¦ط·آ³ط·آ§ط·آ±ط·آ§ط·ع¾ ط·آ®ط·آ§ط·آµط·آ© ط·آ¨ط¸â€¦ط·آ±ط¸ئ’ط·آ² ط·آ§ط¸â€‍ط·آ¯ط·آ¨ط¸â€‍ط¸ث†ط¸â€¦ ط·آ­ط·ع¾ط¸â€° ط¸â€‍ط·آ§ ط·ع¾ط¸ظ¾ط·ع¾ط·آ­ ط·آ£ط·آ¯ط¸ث†ط·آ§ط·ع¾ ط·آ§ط¸â€‍ط·آ³ط·آ­ط·آ§ط·آ¨ط·آ© ط·آ¯ط·آ§ط·آ®ط¸â€‍ Layout ط·آ§ط¸â€‍ط¸â€¦ط·آ¯ط·آ±ط·آ³ط·آ© */}
        <Route path="cloud-health12" element={<CloudStorageHealth12 />} />
        <Route path="cloud-backup12" element={<CloudBackup12 />} />
        <Route path="sync12" element={<Sync12 />} />
        <Route path="suggestions12page" element={<Suggestions12Page />} />
        <Route path="about12" element={<About12 />} />
      </Route>

      {LEGACY_TENANT_PATHS.map((legacyPath) => (
        <Route key={legacyPath} path={`/${legacyPath}`} element={<ProtectedRoute><LegacyTenantRedirect /></ProtectedRoute>} />
      ))}

      
      {/* Legacy / browser-history aliases for platform owner page */}
      <Route path="/ظ…ط§ظ„ظƒ ط§ظ„ظ…ظ†طµط©" element={<Navigate to="/system" replace />} />
      <Route path="/ظ„ظˆط­ط© ظ…ط§ظ„ظƒ ط§ظ„ظ…ظ†طµط©" element={<Navigate to="/system" replace />} />
      <Route path="/ظ…ط¯ظٹط± ط§ظ„ظ†ط¸ط§ظ…" element={<Navigate to="/system" replace />} />
      <Route path="/owner" element={<Navigate to="/system" replace />} />
      <Route path="/platform-owner" element={<Navigate to="/system" replace />} />
      <Route path="/ط³ظˆط¨ط± ط§ظ„ظ…ط­ط§ظپط¸ط©" element={<Navigate to="/super" replace />} />
      <Route path="/ط¨ظˆط§ط¨ط© ظ…ط´ط±ظپ ط§ظ„ظ…ط­ط§ظپط¸ط©" element={<Navigate to="/super" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}













