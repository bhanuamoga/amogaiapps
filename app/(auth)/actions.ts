"use server";

import { z } from "zod";

import { signIn } from "@/auth";
import { postgrest } from "@/lib/postgrest";

const authFormSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const authRegisterFormSchema = z.object({
  user_email: z.string().email(),
  password: z.string().min(6),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  user_mobile: z.string().optional(),
  business_name: z.string().optional(),
  business_number: z.string().optional(),
  store_name: z.string().optional(),
});

export interface LoginActionState {
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data";
}

export const login = async (
  _: LoginActionState,
  formData: z.infer<typeof authFormSchema>
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse({
      email: formData.email,
      password: formData.password,
    });

    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }
    return { status: "failed" };
  }
};

export interface RegisterActionState {
  status:
    | "idle"
    | "in_progress"
    | "success"
    | "failed"
    | "user_exists"
    |"phone_exists"
    | "invalid_data";
  message?: string;
}

export const register = async (
  _: RegisterActionState,
  formData: z.infer<typeof authRegisterFormSchema>
): Promise<RegisterActionState> => {
  try {
    const validatedData = authRegisterFormSchema.parse(formData);

    // Check if email already exists
    const { data: userByEmail } = await postgrest.asAdmin()
      .from("user_catalog")
      .select("*")
      .eq("user_email", validatedData.user_email)
      .maybeSingle();

    if (userByEmail) {
      return { status: "user_exists", message: "Email already registered" };
    }

    // Check if mobile number exists (if provided)
    if (validatedData.user_mobile) {
      const { data: userByMobile } = await postgrest.asAdmin()
        .from("user_catalog")
        .select("*")
        .eq("user_mobile", validatedData.user_mobile)
        .maybeSingle();

      if (userByMobile) {
        return { status: "phone_exists", message: "Mobile number already registered" };
      }
    }

    // Insert new user
    const { data, error: insertError } = await (postgrest.asAdmin()
  .from("user_catalog") as any)
  .insert({
    user_email: validatedData.user_email,
    password: validatedData.password,
    first_name: validatedData.first_name,
    last_name: validatedData.last_name,
    full_name: `${validatedData.last_name} ${validatedData.first_name}`,
    user_mobile: validatedData.user_mobile ,
    business_number: validatedData.business_number,
    business_name: validatedData.business_name ,
    for_business_name: validatedData.business_name ,
    for_business_number: validatedData.business_number,
    store_name: validatedData.store_name || null,
    user_name: validatedData.user_email,
  })
  


    if (insertError) {
      if (
        insertError?.message &&
        insertError?.message.includes("duplicate key") &&
        insertError?.message.includes("user_mobile")
      ) {
        return { status: "failed", message: "Phone number already exists" };
      }
      return { status: "failed" };
    }

    // Auto-login after successful registration
    await signIn("credentials", {
      email: validatedData.user_email,
      password: validatedData.password,
      redirect: false,
    });

    return { status: "success" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "invalid_data" };
    }
    return { status: "failed" };
  }
};
