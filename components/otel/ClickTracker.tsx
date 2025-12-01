// "use client";

// import { useEffect } from "react";
// import { otelInfo } from "@/lib/otel/otel-logger";

// export default function ClickTracker() {
//   useEffect(() => {
//     const handler = (e: any) => {
//       const t = e.target as HTMLElement;
//       otelInfo("CLICK", {
//         page: window.location.pathname,
//         session_id: sessionStorage.getItem("sid"),
//         element: t.tagName,
//         text: t.innerText?.slice(0, 40),
//       });
//     };

//     document.addEventListener("click", handler);
//     return () => document.removeEventListener("click", handler);
//   }, []);

//   return null;
// }
