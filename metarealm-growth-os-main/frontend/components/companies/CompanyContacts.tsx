import { Link2, Mail, Users } from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";
import { initials } from "@/lib/format";
import type { Contact } from "@/types";

export function CompanyContacts({ contacts }: { contacts: Contact[] }) {
  return (
    <WidgetCard
      title="Contacts"
      icon={Users}
      action={{ label: "All contacts", href: "/contacts" }}
    >
      {contacts.length === 0 ? (
        <div className="rounded-md border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
          No contacts yet. Use <span className="font-medium">Find people and emails</span> in
          Reach them.
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-medium">
                {initials(contact.name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{contact.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {contact.role}
                  {contact.email ? ` · ${contact.email}` : ""}
                </p>
              </div>
              {contact.email && (
                <a
                  href={`mailto:${contact.email}`}
                  aria-label={`Email ${contact.name}`}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Mail className="size-3.5" />
                </a>
              )}
              {contact.linkedin && (
                <a
                  href={contact.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`LinkedIn ${contact.name}`}
                  className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Link2 className="size-3.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  );
}
