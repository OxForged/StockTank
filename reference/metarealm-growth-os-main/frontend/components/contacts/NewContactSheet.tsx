"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Company, Contact } from "@/types";

export function NewContactSheet({
  open,
  onOpenChange,
  companies,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Company[];
  onCreate: (contact: Omit<Contact, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const canSubmit = name.trim() !== "" && role.trim() !== "" && companyId !== "";

  const reset = () => {
    setName("");
    setRole("");
    setCompanyId("");
    setEmail("");
    setPhone("");
  };

  const submit = () => {
    const company = companies.find((entry) => entry.id === companyId);
    if (!company) return;
    onCreate({
      name: name.trim(),
      role: role.trim(),
      companyId: company.id,
      company: company.name,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      lastTouch: "Just added",
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New contact</SheetTitle>
          <SheetDescription>
            Saved straight to your database.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-1.5">
          <Label htmlFor="ctc-name">Full name</Label>
          <Input
            id="ctc-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ctc-role">Role</Label>
          <Input
            id="ctc-role"
            placeholder="e.g. Brand Manager"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ctc-company">Company</Label>
          <NativeSelect
            id="ctc-company"
            value={companyId}
            onChange={(event) => setCompanyId(event.target.value)}
          >
            <option value="">Select a company…</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ctc-email">Email</Label>
            <Input
              id="ctc-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ctc-phone">Phone</Label>
            <Input
              id="ctc-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>
        </div>

        <SheetFooter>
          <Button disabled={!canSubmit} onClick={submit}>
            Add contact
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
