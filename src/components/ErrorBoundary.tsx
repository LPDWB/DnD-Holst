"use client";
import { Component, ReactNode } from "react";

type Props = { children: ReactNode };
type State = { hasError: boolean; msg?: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(err: unknown): State {
    const message = err instanceof Error ? err.message : String(err);
    return { hasError: true, msg: message };
  }
  componentDidCatch(err: unknown, info: unknown) {
    console.error("App error:", err, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h2>Что-то пошло не так</h2>
          <pre style={{ whiteSpace: "pre-wrap" }}>{this.state.msg}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
