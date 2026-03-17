// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

// Providers
import { AuthProvider } from "./auth/AuthContext";
import { AppDataProvider } from "./context/AppDataContext";  // ← تأكد من المسار الصحيح
import { TenantProvider } from "./tenant/TenantContext";
import { I18nProvider } from "./i18n/I18nProvider";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      {/* Auth must be outside TenantProvider so Tenant can use the signed-in profile tenantId */}
      <I18nProvider>
        <AuthProvider>
          <TenantProvider>
            <AppDataProvider>
              <App />
            </AppDataProvider>
          </TenantProvider>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);