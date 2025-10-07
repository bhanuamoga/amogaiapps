"use client";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition } from "react";

const signupSchema = z.object({
  fullName: z.string().min(1, { message: "Please enter your name" }),
  email: z.string().email({ message: "Invalid email address" }),
  password: z.string().min(8, { message: "Minimum 8 characters" }),
});

export default function SignupPage() {
  const form = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", email: "", password: "" },
  });

  const pending = false;

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground text-center">
        Create an account to get started
      </p>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => {
            startTransition(() => {
              // call signup action (OTP send) here
            });
          })}
          className="grid gap-2"
        >
          <FormField
            control={form.control}
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
            control={form.control}
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
            control={form.control}
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
  );
}
