import { Routes, Route } from "react-router-dom";

import useIdleLogout from "@urs/shared/lib/useIdleLogout.js";
import NaviAssistant from "@urs/shared/ui/NaviAssistant.jsx";
import LegacyRedirect from "@urs/shared/ui/LegacyRedirect.jsx";
import NotFound from "@urs/shared/NotFound.jsx";

import AdminSignIn from "./AdminSignIn.jsx";
import AdminDashboard from "./AdminDashboard.jsx";

/**
 * The administration deployment.
 *
 * The smallest audience and the widest powers, which is the case for giving it
 * an origin of its own: the roster, the credentials and the audit log are now
 * code that is only ever served to the handful of people who have the address,
 * rather than dead weight inside every student's bundle waiting on a token
 * check.
 *
 * It was called the Dean's Office throughout, and the old /dean addresses still
 * answer, but the role the server checks has always been "admin" — so that is
 * what it is called here too.
 */
export default function App() {
  useIdleLogout();

  return (
    <>
      <Routes>
        <Route path="/"          element={<AdminSignIn />} />
        <Route path="/dashboard" element={<AdminDashboard />} />

        {/* Addresses from when all three roles shared one site. */}
        <Route path="/dean"           element={<LegacyRedirect to="/" />} />
        <Route path="/dean/dashboard" element={<LegacyRedirect to="/dashboard" />} />

        <Route path="*" element={<NotFound />} />
      </Routes>

      <NaviAssistant />
    </>
  );
}
