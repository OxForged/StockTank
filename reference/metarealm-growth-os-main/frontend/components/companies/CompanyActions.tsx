import Link from "next/link";
import { Plus, Zap } from "lucide-react";
import { WidgetCard } from "@/components/shared/WidgetCard";
import { Button } from "@/components/ui/button";

export function CompanyActions() {
  return (
    <WidgetCard title="Actions" icon={Zap}>
      <div className="flex flex-col gap-2">
        <Button size="sm" asChild>
          <Link href="/opportunities">
            <Plus />
            New opportunity
          </Link>
        </Button>
      </div>
    </WidgetCard>
  );
}
