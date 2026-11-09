import "leaflet/dist/leaflet.css";
import React, { ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AdminHomePage } from "./admin/AdminHomePage";
import { AdminLayout } from "./admin/AdminLayout";
import { AdminSitesSection } from "./admin/AdminSitesSection";
import { AdminUsersSection } from "./admin/AdminUsersSection";
import { AuthGate } from "./auth/AuthGate";
import { AuthProvider } from "./auth/AuthContext";
import { RequireRole } from "./auth/RequireRole";
import { ResetPasswordPage } from "./auth/ResetPasswordPage";
import App from "./App";
import "./index.css";
import { initHudScale } from "./lib/hudScale";

initHudScale();

const ADMIN_ROOT = { label: "Administración", to: "/admin" };

/** Todas las rutas /admin exigen rol admin (el backend también lo rechaza con 403). */
function AdminPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <RequireRole role="admin">
      <AdminLayout title={title} crumbs={[ADMIN_ROOT, { label: title }]}>
        {children}
      </AdminLayout>
    </RequireRole>
  );
}

/** Marcador temporal hasta que las páginas nuevas de Colas y Estado reemplacen esta ruta. */
function ComingSoon() {
  return <p className="text-sm text-text-muted">Próximamente</p>;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Público, sin sesión: a donde lleva el enlace del correo de "¿Olvidaste tu contraseña?". */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/*"
            element={
              <AuthGate>
                <Routes>
                  <Route
                    path="/admin"
                    element={
                      <RequireRole role="admin">
                        <AdminHomePage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/users"
                    element={
                      <AdminPage title="Usuarios">
                        <AdminUsersSection />
                      </AdminPage>
                    }
                  />
                  <Route
                    path="/admin/sites"
                    element={
                      <AdminPage title="Sitios">
                        <AdminSitesSection />
                      </AdminPage>
                    }
                  />
                  <Route
                    path="/admin/queues"
                    element={
                      <AdminPage title="Colas">
                        <ComingSoon />
                      </AdminPage>
                    }
                  />
                  <Route
                    path="/admin/status"
                    element={
                      <AdminPage title="Estado de conexión">
                        <ComingSoon />
                      </AdminPage>
                    }
                  />
                  <Route path="/*" element={<App />} />
                </Routes>
              </AuthGate>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
