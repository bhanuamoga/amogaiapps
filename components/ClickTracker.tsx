// components/ClickTracker.tsx
"use client";

import { useEffect } from "react";
import { clientLog } from "@/lib/client-log";

export default function ClickTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = e.target as HTMLElement;

      clientLog("Click event", {
        id: el.id || null,
        tag: el.tagName,
        className: el.className || null,
        text:
          "innerText" in el ? el.innerText.toString().slice(0, 80) : null,
      });
    }

    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  return null;
}
