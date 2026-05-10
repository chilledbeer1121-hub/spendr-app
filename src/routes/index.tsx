import { createFileRoute, Navigate } from "@tanstack/react-router";

// The "/" route — we redirect into the authenticated layout's index handler.
// The _app layout owns the actual home content via _app.index.tsx (path "/").
// This file is replaced/removed by the _app/index file taking over "/".

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/login" />,
});
