import type { Metadata } from "next";
import { SettingsView } from "@/components/settings/SettingsView";
import { BackendOffline } from "@/components/shared/BackendOffline";
import { getSettings } from "@/lib/api/server";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

async function getPrompts() {
  const API_URL =
    process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const res = await fetch(`${API_URL}/settings/prompts`, { cache: "no-store" });
  if (!res.ok) throw new Error("prompts");
  return res.json();
}

export default async function SettingsPage() {
  try {
    const [settings, prompts] = await Promise.all([getSettings(), getPrompts()]);
    return <SettingsView initial={settings} initialPrompts={prompts} />;
  } catch {
    return <BackendOffline />;
  }
}
