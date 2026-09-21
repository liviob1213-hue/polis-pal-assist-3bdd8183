import { Navigate } from "react-router-dom";

// Login unificado: político e assessor entram pela mesma página, só com e-mail.
export default function LoginAssessor() {
  return <Navigate to="/login" replace />;
}
