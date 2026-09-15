import type { Metadata } from "next";
import { MeetingsView } from "@/components/meetings/MeetingsView";
import { BackendOffline } from "@/components/shared/BackendOffline";
import { getCompanies, getMeetings } from "@/lib/api/server";

export const metadata: Metadata = { title: "Meetings" };
export const dynamic = "force-dynamic";

export default async function MeetingsPage() {
  try {
    const [meetings, companies] = await Promise.all([
      getMeetings(),
      getCompanies(),
    ]);
    return <MeetingsView initialMeetings={meetings} companies={companies} />;
  } catch {
    return <BackendOffline />;
  }
}
