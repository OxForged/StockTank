import type { Metadata } from "next";
import { TeamView } from "@/components/team/TeamView";
import { BackendOffline } from "@/components/shared/BackendOffline";

export const metadata: Metadata = { title: "AI Team" };
export const dynamic = "force-dynamic";

async function getAgents() {
  const API_URL =
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const res = await fetch(`${API_URL}/agents`, { cache: "no-store" });
  if (!res.ok) throw new Error("agents");
  return res.json();
}

export default async function TeamPage() {
  try {
    const agents = await getAgents();
    return <TeamView agents={agents} />;
  } catch {
    return <BackendOffline />;
  }
}
