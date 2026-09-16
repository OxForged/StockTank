"use client";

import { useEffect, useState } from "react";

export function DashboardGreeting({ name }: { name: string }) {
  const [greeting, setGreeting] = useState("Good morning");

  useEffect(() => {
    const hour = new Date().getHours();
    setGreeting(
      hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"
    );
  }, []);

  return (
    <div>
      <h2 className="text-2xl font-semibold tracking-tight">
        {greeting}, {name}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Here is where MetaRealm stands right now.
      </p>
    </div>
  );
}
