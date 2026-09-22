import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

import PWAStatus from "@urs/shared/PWA.jsx";
import ErrorBoundary from "@urs/shared/ui/ErrorBoundary.jsx";
import "@urs/shared/index.css";

import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <PWAStatus />
    </BrowserRouter>
  </React.StrictMode>
);
