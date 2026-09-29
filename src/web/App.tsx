import { Route, Routes } from "react-router-dom";
import { AgentAccessPage } from "./routes/AgentAccessPage";
import { AssetCreatePage } from "./routes/AssetCreatePage";
import { AssetHomePage } from "./routes/AssetHomePage";
import { EnvironmentSyncPage } from "./routes/EnvironmentSyncPage";
import { DataCenterPage } from "./routes/HomePage";
import { PlanDetailPage, PlanEditPage, PlanNewPage } from "./routes/PlansPage";
import { AssetsPage, PortfolioDetailPage, PortfolioFormPage } from "./routes/PortfolioPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AssetHomePage />} />
      <Route path="/assets/new" element={<AssetCreatePage />} />
      <Route path="/assets/:id" element={<AssetsPage />} />
      <Route path="/plans/new" element={<PlanNewPage />} />
      <Route path="/plans/:id/edit" element={<PlanEditPage />} />
      <Route path="/plans/:id" element={<PlanDetailPage />} />
      <Route path="/assets" element={<AssetHomePage />} />
      <Route path="/portfolios" element={<AssetHomePage />} />
      <Route path="/portfolios/new" element={<AssetCreatePage />} />
      <Route path="/portfolios/:id/edit" element={<PortfolioFormPage />} />
      <Route path="/portfolios/:id" element={<PortfolioDetailPage />} />
      <Route path="/data-center" element={<DataCenterPage />} />
      <Route path="/agent-access" element={<AgentAccessPage />} />
      <Route path="/environment-sync" element={<EnvironmentSyncPage />} />
      <Route path="*" element={<AssetHomePage />} />
    </Routes>
  );
}
