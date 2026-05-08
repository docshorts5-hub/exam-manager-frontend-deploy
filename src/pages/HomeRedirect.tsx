// src/pages/HomeRedirect.tsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { buildAuthzSnapshot, resolveHomePath } from "../features/authz";

export default function HomeRedirect() {
  const navigate = useNavigate();
  const auth = useAuth() as any;
  const profile = auth?.profile || auth?.userProfile || null;

  useEffect(() => {
    if (auth?.loading) return;
    const path = resolveHomePath(buildAuthzSnapshot(auth));
    navigate(path, { replace: true });
  }, [auth, profile, navigate]);

  return null;
}
