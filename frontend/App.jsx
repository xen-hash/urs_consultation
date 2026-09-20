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
import AvailabilityBoard from "./AvailabilityBoard.jsx";
import NotFound        from "./NotFound.jsx";
import NaviAssistant   from "./ui/NaviAssistant.jsx";

export default function App() {
  // One place for every role, rather than three copies that drift apart.
  useIdleLogout();

  return (
    <>
      <Routes>
        <Route path="/"                  element={<LandingPage />} />
        <Route path="/student"           element={<StudentPortal />} />
        <Route path="/student/register"  element={<StudentRegister />} />
        <Route path="/student/dashboard" element={<StudentDashboard />} />
        <Route path="/teacher"           element={<TeacherPortal />} />
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
        <Route path="/dean"              element={<DeanLogin />} />
        <Route path="/dean/dashboard"    element={<DeanDashboard />} />
        <Route path="/availability"      element={<AvailabilityBoard />} />
        {/* The corridor display is gone; anything still pointing at it lands on
            the public board, which is what it showed anyway. */}
        <Route path="/kiosk"             element={<Navigate to="/availability" replace />} />
        {/* A wrong address is answered, not swallowed. Redirecting silently to
            the front page looks identical to the link having worked and the site
            being empty. */}
        <Route path="*"                  element={<NotFound />} />
      </Routes>

      {/* Outside the Routes so the help bubble survives navigation: it is the
          same Navi on every screen, rather than one per page that remounts and
          forgets what was just asked. */}
      <NaviAssistant />
    </>
  );
}
