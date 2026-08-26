import { Routes, Route, Navigate } from "react-router-dom";
import useIdleLogout from "./useIdleLogout.js";
import LandingPage      from "./LandingPage.jsx";
import StudentPortal    from "./StudentPortal.jsx";
import TeacherPortal    from "./TeacherPortal.jsx";
import StudentRegister  from "./StudentRegister.jsx";
import StudentDashboard from "./StudentDashboard.jsx";
import TeacherDashboard from "./TeacherDashboard.jsx";
import DeanLogin        from "./DeanLogin.jsx";
import DeanDashboard    from "./DeanDashboard.jsx";
import KioskView        from "./KioskView.jsx";

export default function App() {
  // One place for every role, rather than three copies that drift apart.
  useIdleLogout();

  return (
    <Routes>
      <Route path="/"                  element={<LandingPage />} />
      <Route path="/student"           element={<StudentPortal />} />
      <Route path="/student/register"  element={<StudentRegister />} />
      <Route path="/student/dashboard" element={<StudentDashboard />} />
      <Route path="/teacher"           element={<TeacherPortal />} />
      <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
      <Route path="/dean"              element={<DeanLogin />} />
      <Route path="/dean/dashboard"    element={<DeanDashboard />} />
      {/* The same board, twice. /availability is the public one anybody can
          open; /kiosk is it locked to a corridor display. */}
      <Route path="/availability"      element={<KioskView mode="public" />} />
      <Route path="/kiosk"             element={<KioskView mode="kiosk" />} />
      <Route path="*"                  element={<Navigate to="/" replace />} />
    </Routes>
  );
}