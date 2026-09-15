import { Newspaper } from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { WidgetCard } from "@/components/shared/WidgetCard";
import type { NewsItem, NewsRegion } from "@/types";

const regions: { value: NewsRegion; label: string }[] = [
  { value: "morocco", label: "Morocco" },
  { value: "mena", label: "MENA" },
  { value: "web3", label: "Web3" },
];

export function NewsWidget({
  items,
  className,
}: {
  items: NewsItem[];
  className?: string;
}) {
  return (
    <WidgetCard
      title="Gaming industry news"
      icon={Newspaper}
      action={{ label: "Open intelligence", href: "/market-intelligence" }}
      className={className}
    >
      <Tabs defaultValue="morocco">
        <TabsList>
          {regions.map((region) => (
            <TabsTrigger key={region.value} value={region.value}>
              {region.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {regions.map((region) => (
          <TabsContent key={region.value} value={region.value}>
            <ul className="divide-y divide-border/60">
              {items
                .filter((item) => item.region === region.value)
                .map((item) => (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                  >
                    <p className="min-w-0 truncate text-sm leading-snug">
                      {item.title}
                    </p>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {item.source} · {item.publishedAgo}
                    </span>
                  </li>
                ))}
            </ul>
          </TabsContent>
        ))}
      </Tabs>
    </WidgetCard>
  );
}
