import type { Metadata } from "next";
import { KnowledgeView } from "@/components/knowledge/KnowledgeView";
import { BackendOffline } from "@/components/shared/BackendOffline";
import { getKnowledgeDocuments } from "@/lib/api/server";

export const metadata: Metadata = { title: "Knowledge Base" };
export const dynamic = "force-dynamic";

export default async function KnowledgeBasePage() {
  try {
    const documents = await getKnowledgeDocuments();
    return <KnowledgeView initialDocuments={documents} />;
  } catch {
    return <BackendOffline />;
  }
}
