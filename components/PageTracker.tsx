// components/PageTracker.tsx
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { clientLog } from "@/lib/client-log";

export default function PageTracker() {
  const path = usePathname();

  useEffect(() => {
    clientLog("Page viewed", { path });
  }, [path]);

  return null;
}
