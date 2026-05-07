import { Routes, Route, Navigate } from "react-router-dom";
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
      <Route path="/kiosk"             element={<KioskView />} />
      <Route path="*"                  element={<Navigate to="/" replace />} />
    </Routes>
  );
}

