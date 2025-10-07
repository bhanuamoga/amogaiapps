// app/(new-auth)/actions.ts
"use server";

import { z } from "zod";
import { auth } from "@/auth"; // your Auth.js export if needed for session reads
import { signIn } from "@/auth"; // Auth.js signIn
import { postgrest } from "@/lib/postgrest"; // optional: Supabase PostgREST for user insert
// In production, extract schemas to a shared file to avoid duplication with client
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
const signupSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function loginAction(values: z.infer<typeof loginSchema>) {
  try {
    await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    return { success: true, message: "Login successful" };
  } catch (e: any) {
    return { success: false, message: e?.message || "Login failed" };
  }
}

export async function signupAction(values: z.infer<typeof signupSchema>) {
  try {
    // Example: create user in Postgres via PostgREST (hash password in production)
    const { error } = await postgrest.asAdmin().from("user_catalog").insert({
      user_email: values.email,
      full_name: values.fullName,
      password: values.password, // hash with bcrypt before insert
    });

    if (error) {
      return { success: false, message: error.message };
    }

    // Optionally send OTP/email here, or auto-login after creation
    return { success: true, message: "Signup successful! Check your email for OTP." };
  } catch (e: any) {
    return { success: false, message: e?.message || "Signup failed" };
  }
}
