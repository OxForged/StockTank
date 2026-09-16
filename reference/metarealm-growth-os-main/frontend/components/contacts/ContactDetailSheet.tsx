"use client";

import Link from "next/link";
import { ArrowUpRight, ExternalLink, Mail, Phone } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { initials } from "@/lib/format";
import type { Contact } from "@/types";

export function ContactDetailSheet({
  contact,
  onOpenChange,
}: {
  contact: Contact | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={contact !== null} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        {contact && (
          <>
            <div className="flex items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary text-base font-semibold">
                {initials(contact.name)}
              </span>
              <SheetHeader>
                <SheetTitle>{contact.name}</SheetTitle>
                <SheetDescription>{contact.role}</SheetDescription>
              </SheetHeader>
            </div>

            <Link
              href={`/companies/${contact.companyId}`}
              className="group inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {contact.company}
              <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </Link>

            <Separator />

            <dl className="space-y-3 text-sm">
              {contact.email && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="size-3.5" />
                    Email
                  </dt>
                  <dd>
                    <a
                      href={`mailto:${contact.email}`}
                      className="transition-colors hover:text-primary"
                    >
                      {contact.email}
                    </a>
                  </dd>
                </div>
              )}
              {contact.phone && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <Phone className="size-3.5" />
                    Phone
                  </dt>
                  <dd>{contact.phone}</dd>
                </div>
              )}
              {contact.linkedin && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">LinkedIn</dt>
                  <dd>
                    <a
                      href={`https://${contact.linkedin}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                    >
                      Profile
                      <ExternalLink className="size-3" />
                    </a>
                  </dd>
                </div>
              )}
              {contact.lastTouch && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Last touch</dt>
                  <dd className="text-muted-foreground">{contact.lastTouch}</dd>
                </div>
              )}
            </dl>

            {contact.notes && (
              <>
                <Separator />
                <div>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Notes
                  </p>
                  <p className="rounded-md border border-border/60 bg-secondary/30 p-3 text-sm leading-relaxed">
                    {contact.notes}
                  </p>
                </div>
              </>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
