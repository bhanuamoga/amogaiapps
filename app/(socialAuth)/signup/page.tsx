"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordInput } from "@/components/password-input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { FcGoogle } from "react-icons/fc";
import { Github, Mail, Phone, Send } from "lucide-react";
import { signIn } from "next-auth/react";
import { FaFacebook, FaLinkedin } from "react-icons/fa";

const emailSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export default function SignUpPage() {
  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
  });

  return (
    <>
      <Tabs defaultValue="email">
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="email">
            <Mail className="mr-1 h-4 w-4" /> Email
          </TabsTrigger>
          <TabsTrigger value="phone">
            <Phone className="mr-1 h-4 w-4" /> Phone
          </TabsTrigger>
          <TabsTrigger value="otp">
            <Send className="mr-1 h-4 w-4" /> Email OTP
          </TabsTrigger>
        </TabsList>

        {/* EMAIL SIGNUP */}
        <TabsContent value="email">
          <Form {...emailForm}>
            <form className="space-y-4">
              <FormField
                control={emailForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="you@example.com"/>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={emailForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <PasswordInput {...field} placeholder="••••••••" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={emailForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <PasswordInput {...field} placeholder="••••••••" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button className="w-full">Create Account</Button>
            </form>
          </Form>
        </TabsContent>

        {/* PHONE */}
        <TabsContent value="phone">
          <Input placeholder="Phone number" />
          <Button className="mt-4 w-full">Send OTP</Button>
        </TabsContent>

        {/* EMAIL OTP */}
        <TabsContent value="otp">
          <Input placeholder="Email address" />
          <Button className="mt-4 w-full">Send OTP</Button>
        </TabsContent>
      </Tabs>

      {/* SOCIAL */}
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
