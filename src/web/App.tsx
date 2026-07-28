import { Route, Routes } from "react-router-dom";
import { AgentAccessPage } from "./routes/AgentAccessPage";
import { EnvironmentSyncPage } from "./routes/EnvironmentSyncPage";
import { HomePage } from "./routes/HomePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/agent-access" element={<AgentAccessPage />} />
      <Route path="/environment-sync" element={<EnvironmentSyncPage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
