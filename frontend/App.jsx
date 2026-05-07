import { Routes, Route, Navigate } from "react-router-dom";
import LandingPage      from "./pages/LandingPage.jsx";
import StudentPortal    from "./pages/StudentPortal.jsx";
import TeacherPortal    from "./pages/TeacherPortal.jsx";
import StudentRegister  from "./pages/StudentRegister.jsx";
import StudentDashboard from "./pages/StudentDashboard.jsx";
import TeacherDashboard from "./pages/TeacherDashboard.jsx";
import DeanLogin        from "./pages/DeanLogin.jsx";
import DeanDashboard    from "./pages/DeanDashboard.jsx";
import KioskView        from "./pages/KioskView.jsx";

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