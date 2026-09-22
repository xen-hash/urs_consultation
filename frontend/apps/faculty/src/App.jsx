import { Routes, Route } from "react-router-dom";

import useIdleLogout from "@urs/shared/lib/useIdleLogout.js";
import NaviAssistant from "@urs/shared/ui/NaviAssistant.jsx";
import LegacyRedirect from "@urs/shared/ui/LegacyRedirect.jsx";
import NotFound from "@urs/shared/NotFound.jsx";

import FacultySignIn from "./FacultySignIn.jsx";
import FacultyDashboard from "./FacultyDashboard.jsx";

/**
 * The faculty deployment.
 *
 * A staff door, so its root is the sign-in rather than a menu: everybody who
 * opens this address is here to do one of two things, and the second needs the
 * first. There is no public page on this origin at all, which is the point of
 * it being its own origin — nothing a student can reach ships in this bundle.
 */
export default function App() {
  useIdleLogout();

  return (
    <>
      <Routes>
        <Route path="/"          element={<FacultySignIn />} />
        <Route path="/dashboard" element={<FacultyDashboard />} />

        {/* Addresses from when all three roles shared one site — including the
            ones printed on the ID cards already in circulation. */}
        <Route path="/teacher"           element={<LegacyRedirect to="/" />} />
        <Route path="/teacher/dashboard" element={<LegacyRedirect to="/dashboard" />} />

        <Route path="*" element={<NotFound />} />
      </Routes>

      <NaviAssistant />
    </>
  );
}
