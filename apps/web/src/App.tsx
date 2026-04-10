import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthContext";
import { Layout } from "@/components/Layout";
import { NotesPage } from "@/pages/NotesPage/index";
import { PageLayeringDemo } from "@/pages/PageLayeringDemo/index";
import { SitesPage } from "@/pages/SitesPage/index";
import { SyncedFilesPage } from "@/pages/SyncedFilesPage";
import { UploadPage } from "@/pages/UploadPage";
import { Test } from "@/pages/Test";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<NotesPage />} />
          <Route path="sites" element={<SitesPage />} />
          <Route path="synced" element={<SyncedFilesPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="test" element={<Test />} />
          <Route path="layering-demo" element={<PageLayeringDemo />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
