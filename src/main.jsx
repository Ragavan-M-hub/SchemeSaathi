import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { LanguageProvider } from "./i18n/LanguageContext.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { AppProvider } from "./context/AppContext.jsx";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <LanguageProvider>
      <AuthProvider>
        <AppProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AppProvider>
      </AuthProvider>
    </LanguageProvider>
  </React.StrictMode>
);