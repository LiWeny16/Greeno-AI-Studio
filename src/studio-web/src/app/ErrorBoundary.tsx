"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/button";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4 rounded-modal border border-danger/30 bg-panel p-8 shadow-lg">
            <AlertTriangle className="h-8 w-8 text-danger" />
            <h2 className="text-body font-semibold text-foreground">
              Something went wrong
            </h2>
            <p className="text-compact text-muted-foreground text-center max-w-sm">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
            <Button
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="h-4 w-4" />
              Reload
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
