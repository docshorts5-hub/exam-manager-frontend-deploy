import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import SuperGovernorates from "../SuperGovernorates";
import { isMinistrySuperViewer } from "./ministryPageGuard";
import MinistryHomePanel from "./MinistryHomePanel";
import "./MinistrySuperSystemView.css";

export default function MinistryAwareSuperHome() {
  const auth = useAuth() as any;
  const navigate = useNavigate();

  if (auth?.loading) return null;

  if (!isMinistrySuperViewer(auth)) {
    return <SuperGovernorates />;
  }

  return (
    <MinistryHomePanel
      userEmail={String(auth?.user?.email || "").trim()}
      onLogout={() => auth?.logout?.()}
      onOpenSystem={() => navigate("/super-system")}
      onOpenTotp={() => navigate("/security/totp-reset")}
    />
  );
}
