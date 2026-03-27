import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function LegacyTenantRedirect() {
  const location = useLocation();
  const target = "/";
  return <Navigate to={target} replace state={{ from: location }} />;
}
