import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import ursLogo from "../URS_LOGO.png";
import { currentRole, clearSession } from "../auth.js";
import { Modal, Button } from "./index.jsx";

/**
 * The university name in the top bar, as the way back to the front page.
 *
 * The logo and title were static text on every screen, so the one thing people
 * instinctively click to get home did nothing — and the sign-in screens had no
 * other way out either. This makes it the home link everywhere.
 *
 * Signed in, the front page is the wrong place to be dropped silently: it is
 * public, it looks signed out, and on a shared campus machine leaving a live
 * session behind it is how the next person ends up in someone else's account.
 * So a signed-in tap asks first, and going home means signing out.
 */

const ROLE_NOUN = {
  student: "a student",
  teacher: "faculty",
  admin: "an administrator",
};

export default function HomeBrand({
  title = "University of Rizal System",
  subtitle,
  tone = "light",
  className = "",
  titleClassName = "text-sm truncate",
}) {
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const role = currentRole();

  const goHome = () => navigate("/");

  const handleClick = () => {
    if (role) setAsking(true);
    else goHome();
  };

  const signOutAndGo = () => {
    clearSession();
    setAsking(false);
    goHome();
  };

  const text = tone === "dark"
    ? { title: "text-white", sub: "text-white/60", hover: "hover:bg-white/10" }
    : { title: "text-fg", sub: "text-muted-fg", hover: "hover:bg-surface-2" };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title="Go to the main page"
        className={`flex items-center gap-2 xs:gap-3 min-w-0 text-left -ml-2 px-2 py-1 rounded-lg
                    transition-colors duration-200 ${text.hover} ${className}`}
      >
        {/* A little smaller under 400px, where the row has the least to give. */}
        <img src={ursLogo} alt="" aria-hidden="true"
          className="w-7 h-7 xs:w-8 xs:h-8 object-contain shrink-0" />
        <span className="min-w-0">
          {/* Truncating by default, but a caller with a narrow bar can let the
              name wrap instead — half a name under an ellipsis is worse than
              two lines of the whole one. */}
          <span className={`block font-semibold ${text.title} ${titleClassName}`}>{title}</span>
          {subtitle && <span className={`block text-xs truncate ${text.sub}`}>{subtitle}</span>}
        </span>
      </button>

      <Modal
        open={asking}
        onClose={() => setAsking(false)}
        size="sm"
        anchor="center"
        title="Return to the main page?"
        footer={
          <>
            <Button onClick={() => setAsking(false)}>Stay on this page</Button>
            <Button variant="danger" icon={LogOut} onClick={signOutAndGo}>
              Sign out and return
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-fg">
          You're signed in as {ROLE_NOUN[role] || "a user"}. The main page is public, so
          going back there signs you out on this device. Anything you haven't sent yet
          will be lost.
        </p>
      </Modal>
    </>
  );
}
