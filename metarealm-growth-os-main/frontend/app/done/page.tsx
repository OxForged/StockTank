import type { Metadata } from "next";
import { DoneView } from "@/components/dashboard/DoneView";
import { BackendOffline } from "@/components/shared/BackendOffline";

export const metadata: Metadata = { title: "Finished tasks" };
export const dynamic = "force-dynamic";

async function getDone() {
  const API_URL =
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const res = await fetch(`${API_URL}/focus/done`, { cache: "no-store" });
  if (!res.ok) throw new Error("done");
  return res.json();
}

export default async function DonePage() {
  try {
    const done = await getDone();
    return <DoneView tasks={done} />;
  } catch {
    return <BackendOffline />;
  }
}
