import { ServerOff } from "lucide-react";

/** Rendered when a page cannot reach the API. */
export function BackendOffline() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/40 p-10 text-center">
      <div className="grid size-11 place-items-center rounded-lg bg-secondary">
        <ServerOff className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">Backend not reachable</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Start the database and API, then refresh this page.
        </p>
      </div>
      <code className="rounded-md bg-secondary/60 px-3 py-2 font-mono text-xs">
        docker compose -f docker/docker-compose.yml up -d
      </code>
      <p className="max-w-md text-[11px] leading-relaxed text-muted-foreground">
        Quick run without Docker: open a terminal in backend/ and run
        uvicorn app.main:app — it falls back to a local SQLite file.
      </p>
    </div>
  );
}
