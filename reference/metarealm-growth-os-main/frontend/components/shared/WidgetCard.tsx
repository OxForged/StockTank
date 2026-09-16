import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WidgetCardProps {
  title: string;
  icon?: LucideIcon;
  /** Optional "View all →" style link in the header. */
  action?: { label: string; href: string };
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

/** Standard frame for every dashboard widget: quiet header, action link, content. */
export function WidgetCard({
  title,
  icon: Icon,
  action,
  className,
  contentClassName,
  children,
}: WidgetCardProps) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
          {Icon && <Icon className="size-4 text-muted-foreground/70" />}
          {title}
        </CardTitle>
        {action && (
          <Link
            href={action.href}
            className="group inline-flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {action.label}
            <ArrowUpRight className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent className={cn("flex-1", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
