"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import LoginPage from "./login/page";
import SignupPage from "./signup/page";

export default function AuthPage() {
  const [tab, setTab] = useState<"login" | "signup">("login");

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-full p-6">
        {/* Tab buttons */}
        <div className="flex rounded-full border bg-muted/40 p-1 text-sm">
          <button
            className={`w-1/2 rounded-full py-1 transition ${
              tab === "login" ? "bg-background shadow" : "text-muted-foreground"
            }`}
            onClick={() => setTab("login")}
          >
            Login
          </button>
          <button
            className={`w-1/2 rounded-full py-1 transition ${
              tab === "signup" ? "bg-background shadow" : "text-muted-foreground"
            }`}
            onClick={() => setTab("signup")}
          >
            Get Started
          </button>
        </div>

        {/* Show the selected page */}
        <div className="mt-4">
          {tab === "login" ? <LoginPage /> : <SignupPage />}
        </div>
      </Card>
    </div>
  );
}
