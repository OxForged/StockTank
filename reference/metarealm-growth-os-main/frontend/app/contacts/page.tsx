import type { Metadata } from "next";
import { ContactsView } from "@/components/contacts/ContactsView";
import { BackendOffline } from "@/components/shared/BackendOffline";
import { getCompanies, getContacts } from "@/lib/api/server";

export const metadata: Metadata = { title: "Contacts" };
export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  try {
    const [contacts, companies] = await Promise.all([
      getContacts(),
      getCompanies(),
    ]);
    return <ContactsView initialContacts={contacts} companies={companies} />;
  } catch {
    return <BackendOffline />;
  }
}
