import { useSearchParams } from "react-router-dom";
import { Clock } from "lucide-react";
import { Alert } from "../SharedUI.jsx";
import { IDLE_MINUTES } from "../useIdleLogout.js";

/**
 * Explains an automatic sign-out on the login screen.
 *
 * Being returned to a login form with no explanation reads as the app losing
 * your session at random, which is the sort of thing people stop trusting.
 */
export default function SignedOutNotice() {
  const [params] = useSearchParams();
  if (params.get("signedOut") !== "idle") return null;
  return (
    <div className="mb-4">
      <Alert tone="info" icon={Clock}>
        You were signed out after {IDLE_MINUTES} minutes of inactivity. Please sign in again.
      </Alert>
    </div>
  );
}
