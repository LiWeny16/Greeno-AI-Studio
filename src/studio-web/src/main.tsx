import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { ErrorBoundary } from "./app/ErrorBoundary";
import { QueryProvider } from "./lib/api";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryProvider>
        <App />
      </QueryProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
