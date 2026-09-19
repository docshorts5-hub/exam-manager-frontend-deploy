import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import SuperPortal from "../SuperPortal";
import { isMinistrySuperViewer } from "./ministryPageGuard";
import MinistryHomePanel from "./MinistryHomePanel";
import "./MinistrySuperSystemView.css";

export default function MinistryAwareSuperPortal() {
  const auth = useAuth() as any;
  const navigate = useNavigate();

  if (auth?.loading) return null;

  if (!isMinistrySuperViewer(auth)) {
    return <SuperPortal />;
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
