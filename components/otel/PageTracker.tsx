// "use client";

// import { useEffect } from "react";
// import { otelInfo } from "@/lib/otel/otel-logger";

// export default function PageTracker() {
//   useEffect(() => {
//     otelInfo("PAGE_VIEW", {
//       page: window.location.pathname,
//       session_id: getSessionId(),
//     });
//   }, []);

//   return null;
// }

// function getSessionId() {
//   if (!sessionStorage.getItem("sid")) {
//     sessionStorage.setItem("sid", crypto.randomUUID());
//   }
//   return sessionStorage.getItem("sid")!;
// }
