"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

export default function ChatRootRedirect() {
  const router = useRouter();

  useEffect(() => {
    const newUuid = uuidv4();
    router.replace(`/chatwithpage/${newUuid}`);
  }, [router]);

  return <div className="p-8 text-center text-gray-500">Redirecting...</div>;
}
