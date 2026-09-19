import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { buildAuthzSnapshot, isPlatformOwner } from "../features/authz";
import { MINISTRY_SCOPE } from "../constants/directorates";
import { isMinistrySuperViewer } from "./ministry/ministryPageGuard";
import SuperSystem from "./SuperSystem";
import GovernorateSuperModel3Preview from "./GovernorateSuperModel3Preview";

import "./SuperSystemOmanBrand.css";
function text(value: unknown): string {
  return String(value ?? "").trim();
}

function getGovernorateFromAuth(auth: any): string {
  const allow = auth?.allow || {};
  const profile = auth?.profile || auth?.userProfile || {};
  const claims = auth?.claims || auth?.tokenClaims || {};

  return text(
    auth?.supportGovernorate ||
      auth?.supportGov ||
      auth?.actingGovernorate ||
      allow?.supportGovernorate ||
      allow?.supportGov ||
      allow?.actingGovernorate ||
      profile?.supportGovernorate ||
      profile?.supportGov ||
      profile?.actingGovernorate ||
      claims?.supportGovernorate ||
      claims?.supportGov ||
      claims?.actingGovernorate ||
      allow?.governorate ||
      allow?.tenantGovernorate ||
      profile?.governorate ||
      profile?.tenantGovernorate ||
      auth?.governorate ||
      "",
  );
}

export default function GovernorateAwareSuperSystem() {
  const auth = useAuth() as any;
  const location = useLocation();

  const snapshot = useMemo(() => buildAuthzSnapshot(auth), [auth]);
  const params = new URLSearchParams(location.search || "");

  const isOwner = isPlatformOwner(snapshot);
  const myGov = getGovernorateFromAuth(auth);

  const isMinistryViewer =
    !isOwner &&
    (isMinistrySuperViewer(auth as any) || myGov === MINISTRY_SCOPE);

  const legacyMode =
    params.get("legacy") === "1" ||
    params.get("classic") === "1" ||
    params.get("old") === "1";

  // القاعدة المعتمدة:
  // - مشرف الوزارة يبقى كما هو.
  // - legacy=1 يفتح صفحة SuperSystem القديمة.
  // - مشرف المحافظة يرى التصميم الجديد.
  // - مالك المنصة يرى التصميم الجديد أيضًا.
  if (legacyMode || isMinistryViewer) {
    return <SuperSystem />;
  }

  return <GovernorateSuperModel3Preview />;
}
