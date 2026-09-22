import { Routes, Route, Navigate } from "react-router-dom";

import useIdleLogout from "@urs/shared/lib/useIdleLogout.js";
import NaviAssistant from "@urs/shared/ui/NaviAssistant.jsx";
import LegacyRedirect from "@urs/shared/ui/LegacyRedirect.jsx";
import NotFound from "@urs/shared/NotFound.jsx";

import LandingPage from "./LandingPage.jsx";
import AvailabilityBoard from "./AvailabilityBoard.jsx";
import StudentSignIn from "./StudentSignIn.jsx";
import StudentRegister from "./StudentRegister.jsx";
import StudentDashboard from "./StudentDashboard.jsx";

/**
 * The student deployment — and the public one.
 *
 * Three apps, but only two audiences need a door: staff know which address is
 * theirs, and everybody else arrives here. So this app carries the front page
 * and the availability board as well as the student screens, because the board
 * is the single most common reason anybody opens the system at all and it needs
 * no account. Putting it behind the student sign-in, or on a fourth deployment,
 * would be putting the most-used screen somewhere nobody is looking.
 */
export default function App() {
  useIdleLogout();

  return (
    <>
      <Routes>
        <Route path="/"             element={<LandingPage />} />
        <Route path="/availability" element={<AvailabilityBoard />} />
        <Route path="/sign-in"      element={<StudentSignIn />} />
        <Route path="/register"     element={<StudentRegister />} />
        <Route path="/dashboard"    element={<StudentDashboard />} />

        {/* Addresses from when all three roles shared one site. See
            LegacyRedirect for why these are kept. */}
        <Route path="/student"           element={<LegacyRedirect to="/sign-in" />} />
        <Route path="/student/register"  element={<LegacyRedirect to="/register" />} />
        <Route path="/student/dashboard" element={<LegacyRedirect to="/dashboard" />} />
        {/* The corridor display is gone; anything still pointing at it lands on
            the public board, which is what it showed anyway. */}
        <Route path="/kiosk"             element={<Navigate to="/availability" replace />} />

        {/* A wrong address is answered, not swallowed. Redirecting silently to
            the front page looks identical to the link having worked and the
            site being empty. */}
        <Route path="*" element={<NotFound />} />
      </Routes>

      {/* Outside the Routes so the help bubble survives navigation: it is the
          same Navi on every screen, rather than one per page that remounts and
          forgets what was just asked. */}
      <NaviAssistant />
    </>
  );
}
