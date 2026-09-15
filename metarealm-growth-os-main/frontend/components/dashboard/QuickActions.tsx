import Link from "next/link";
import { Building2, PenSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuickActions() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" asChild>
        <Link href="/opportunities">
          <Plus />
          New opportunity
        </Link>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <Link href="/content">
          <PenSquare />
          Draft post
        </Link>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <Link href="/companies">
          <Building2 />
          Add company
        </Link>
      </Button>
    </div>
  );
}
