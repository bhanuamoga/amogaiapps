"use client";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/password-input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { FcGoogle } from "react-icons/fc";
import { Github } from "lucide-react";
import Link from "next/link";
import { FaFacebook, FaLinkedin } from "react-icons/fa";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function SignInPage() {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  return (
    <>
      {/* FORM */}
      <Form {...form}>
        <form className="space-y-4">
          {/* EMAIL */}
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="you@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* PASSWORD + FORGOT */}
          <FormField
            control={form.control}
            name="password"
            
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-sm text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <PasswordInput {...field}   placeholder="••••••••"/>
                  
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* SUBMIT */}
          <Button className="w-full">Sign In</Button>
        </form>
      </Form>

      {/* DIVIDER */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      {/* SOCIAL BUTTONS */}
      {/* <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          onClick={() => signIn("google")}
          className="flex items-center justify-center"
        >
          <FcGoogle className="mr-2 h-4 w-4" />
          Google
        </Button>

        <Button
          variant="outline"
          onClick={() => signIn("github")}
          className="flex items-center justify-center"
        >
          <Github className="mr-2 h-4 w-4" />
          GitHub
        </Button>
      </div> */}
      <div className="grid grid-cols-2 gap-3">
  {/* GOOGLE */}
  <Button
    variant="outline"
    className="flex items-center justify-center"
    onClick={() => signIn("google")}
  >
    <FcGoogle className="mr-2 h-4 w-4" />
    Google
  </Button>

  {/* GITHUB */}
  <Button
    variant="outline"
    className="flex items-center justify-center"
    onClick={() => signIn("github")}
  >
    <Github className="mr-2 h-4 w-4" />
    GitHub
  </Button>

  {/* FACEBOOK */}
  <Button
    variant="outline"
    className="flex items-center justify-center"
    onClick={() => signIn("facebook")}
  >
    <FaFacebook className="mr-2 h-4 w-4 text-blue-600" />
    Facebook
  </Button>

  {/* LINKEDIN */}
  <Button
    variant="outline"
    className="flex items-center justify-center"
    onClick={() => signIn("linkedin")}
  >
    <FaLinkedin className="mr-2 h-4 w-4 text-sky-700" />
    LinkedIn
  </Button>
</div>

    </>
  );
}
