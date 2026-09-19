import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { buildAuthzSnapshot, isPlatformOwner } from "../../../features/authz";

export default function OwnerOperationalReturnOverlay() {
  const auth = useAuth() as any;
  const navigate = useNavigate();

  if (auth?.loading) return null;

  const owner = isPlatformOwner(buildAuthzSnapshot(auth));
  if (!owner) return null;

  return (
    <button
      type="button"
      onClick={() => navigate("/system")}
      style={{
        position: "fixed",
        left: 18,
        bottom: 18,
        zIndex: 20000,
        minHeight: 42,
        padding: "9px 16px",
        border: "1px solid #17345f",
        borderRadius: 12,
        background: "#17345f",
        color: "#ffffff",
        fontFamily: "inherit",
        fontWeight: 900,
        cursor: "pointer",
        boxShadow: "0 8px 22px rgba(15,23,42,.18)",
      }}
    >
      ← العودة إلى لوحة مالك المنصة
    </button>
  );
}
