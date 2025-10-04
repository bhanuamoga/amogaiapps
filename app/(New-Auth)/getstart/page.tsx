"use client";

import { useState, startTransition } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Github, Facebook, Loader2, MessageSquare } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Minimum 8 characters" }),
});

const signupSchema = z.object({
  fullName: z.string().min(1, { message: "Please enter your name" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Minimum 8 characters" }),
});

export default function AuthCardTabs() {
  const [tab, setTab] = useState<"login" | "signup">("signup");

  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  const pending = false;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gray-50">
      <Card className="w-full max-w-md p-6 rounded-2xl shadow-lg">
        {/* Chat Icon Header */}
        <div className="flex flex-col items-center mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white mb-2 shadow-md">
            <MessageSquare className="h-6 w-6" />
          </div>
          <div className="text-center text-xl font-semibold tracking-tight">stor.chat</div>
          <div className="text-xs text-muted-foreground">Store AI Assistant</div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex rounded-full border bg-muted/30 p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("login")}
            aria-selected={tab === "login"}
            className={`w-1/2 rounded-full py-2 font-medium transition-colors duration-200 ${
              tab === "login"
                ? "bg-white shadow-md text-black"
                : "text-muted-foreground hover:bg-white hover:text-black"
            }`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setTab("signup")}
            aria-selected={tab === "signup"}
            className={`w-1/2 rounded-full py-2 font-medium transition-colors duration-200 ${
              tab === "signup"
                ? "bg-white shadow-md text-black"
                : "text-muted-foreground hover:bg-white hover:text-black"
            }`}
          >
            Get Started
          </button>
        </div>

        {/* Forms container */}
        <div className="mt-4">
          {tab === "login" ? (
            <>
              <p className="mb-4 text-sm text-muted-foreground text-start">
                Enter your email and password below <br /> to log into your account
              </p>
              <Form {...loginForm}>
                <form
                  onSubmit={loginForm.handleSubmit((values) => {
                    startTransition(() => {
                      // call login action here
                    });
                  })}
                  className="grid gap-2"
                >
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="name@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <div className="flex items-center justify-between">
                          <FormLabel>Password</FormLabel>
                          <Link href="#" className="text-sm font-medium text-muted-foreground hover:opacity-75">
                            Forgot password?
                          </Link>
                        </div>
                        <FormControl>
                          <PasswordInput placeholder="********" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button className="mt-2" disabled={pending}>
                    Login
                    {pending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  </Button>
                </form>
              </Form>
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground text-center">
                Create an account to get started
              </p>
              <Form {...signupForm}>
                <form
                  onSubmit={signupForm.handleSubmit((values) => {
                    startTransition(() => {
                      // call signup action (OTP send) here
                    });
                  })}
                  className="grid gap-2"
                >
                  <FormField
                    control={signupForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="john@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="space-y-1">
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <PasswordInput placeholder="Minimum 8 characters" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Green notice box */}
                  <div className="rounded-md border border-emerald-300/60 bg-emerald-50/60 p-3 text-sm text-emerald-700">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-emerald-400" />
                      <span>Create Account</span>
                    </div>
                    <p className="mt-1 pl-6">
                      We&apos;ll send an OTP to your email to verify your account.
                    </p>
                  </div>

                  <Button className="mt-1 bg-black text-white hover:bg-black/90" disabled={pending}>
                    Create Account &amp; Send OTP
                    {pending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  </Button>
                </form>
              </Form>
            </>
          )}

          {/* Divider */}
          <div className="relative my-3">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          {/* Social buttons */}
          <div className="flex items-center gap-2">
            <Button variant="outline" className="w-full" type="button">
              <Github className="mr-2 h-4 w-4" />
              GitHub
            </Button>
            <Button variant="outline" className="w-full" type="button">
              <Facebook className="mr-2 h-4 w-4" />
              Facebook
            </Button>
          </div>

          {/* Footer */}
          <p className="mt-4 px-8 text-center text-sm text-muted-foreground">
            By clicking login, you agree to our{" "}
            <a href="#" className="underline underline-offset-4 hover:text-primary">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="underline underline-offset-4 hover:text-primary">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </Card>
    </div>
  );
}
