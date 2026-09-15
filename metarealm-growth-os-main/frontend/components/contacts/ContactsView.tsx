"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Mail, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createContact, deleteContact } from "@/lib/api/client";
import { initials } from "@/lib/format";
import type { Company, Contact } from "@/types";
import { ContactDetailSheet } from "./ContactDetailSheet";
import { NewContactSheet } from "./NewContactSheet";

/**
 * Owns contact state for the session. In Milestone 4 these handlers
 * become API calls; the presentation below does not change.
 */
export function ContactsView({
  initialContacts,
  companies,
}: {
  initialContacts: Contact[];
  companies: Company[];
}) {
  const [contacts, setContacts] = useState(initialContacts);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const q = query.trim().toLowerCase();
  const filtered = contacts.filter(
    (contact) =>
      !q ||
      contact.name.toLowerCase().includes(q) ||
      contact.role.toLowerCase().includes(q) ||
      contact.company.toLowerCase().includes(q)
  );

  const selectedContact =
    contacts.find((contact) => contact.id === selectedId) ?? null;

  const onDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}? Do this when you are done with the deal.`)) return;
    try {
      await deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, role, or company…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}>
          <Plus />
          New contact
        </Button>
      </div>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-border/60">
          {filtered.map((contact) => (
            <li key={contact.id} className="group relative">
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(contact.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedId(contact.id);
                  }
                }}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-semibold">
                  {initials(contact.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {contact.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {contact.role}
                  </span>
                </span>
                <Link
                  href={`/companies/${contact.companyId}`}
                  onClick={(event) => event.stopPropagation()}
                  className="hidden w-40 shrink-0 truncate text-right text-xs text-muted-foreground transition-colors hover:text-foreground sm:block"
                >
                  {contact.company}
                </Link>
                <span className="hidden w-40 shrink-0 truncate text-right text-xs text-muted-foreground lg:block">
                  {contact.lastTouch}
                </span>
                {contact.email ? (
                  <Mail className="size-3.5 shrink-0 text-muted-foreground/60" />
                ) : (
                  <span className="size-3.5 shrink-0" />
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
              </div>
              <button
                onClick={() => onDelete(contact.id, contact.name)}
                aria-label={`Delete ${contact.name}`}
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md bg-card text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No contacts match your search.
          </div>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {contacts.length} contacts
      </p>

      <ContactDetailSheet
        contact={selectedContact}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
      <NewContactSheet
        open={newOpen}
        onOpenChange={setNewOpen}
        companies={companies}
        onCreate={async (draft) => {
          try {
            const created = await createContact(draft);
            setContacts((prev) => [created, ...prev]);
          } catch (error) {
            console.error(error);
          }
        }}
      />
    </div>
  );
}
