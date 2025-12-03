"use server";

import { z } from "zod";

import { signIn } from "@/auth";
import { postgrest } from "@/lib/postgrest";
import { extractIP, extractGeo, extractDevice } from "@/lib/deviceGeo";
import { UAParser } from "ua-parser-js";
import { headers } from "next/headers";

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
  status: "idle" | "in_progress" | "success" | "failed" | "invalid_data"|"Not Authorized";
}


export const login = async (
  _: LoginActionState,
  formData: z.infer<typeof authFormSchema>
): Promise<LoginActionState> => {
  try {
    const validatedData = authFormSchema.parse(formData);

    // Fetch full user record
    const { data: user } = await postgrest.asAdmin()
      .from("user_catalog")
      .select(`
        user_catalog_id,
        user_name,
        user_email,
        full_name,
        user_mobile,
        business_name,
        business_number,
        for_business_name,
        for_business_number,
        roles_json
      `)
      .eq("user_email", validatedData.email)
      .maybeSingle();

    if (!user) return { status: "failed" };

    const roles = Array.isArray(user.roles_json)
      ? user.roles_json
      : JSON.parse(user.roles_json || "[]");

    if (!roles.includes("Store Manager")) {
      return { status: "Not Authorized" };
    }

    // Perform login
    await signIn("credentials", {
      email: validatedData.email,
      password: validatedData.password,
      redirect: false,
    });

    // ------------------------
    // SERVER ONLY: Get request headers - ✅ FIXED WITH AWAIT
    // ------------------------
    const headersList = await headers();  // ✅ AWAIT fixes TypeScript
    const userAgent = headersList.get("user-agent") || "Unknown";

    const ip = await extractIP(headersList);  // ✅ Pass awaited headers
    const geo = await extractGeo(ip);
    const device = extractDevice(userAgent);

    // ------------------------
    // Save Login Log
    // ------------------------
    await postgrest.asAdmin()
      .from("user_log")
      .insert({
        status: "success",
        event_type: "login_success",
        description: "User login successful",

        // User info
        user_id: user.user_catalog_id,
        user_name: user.user_name,
        user_email: user.user_email,
        full_name: user.full_name,
        user_mobile: user.user_mobile,
        role: "Store Manager",

        // Network
        user_ip_address: ip,
        host_header: headersList.get("host") || "unknown",  // ✅ Now works
        user_agent: userAgent,

        // Device
        browser: device.browser,
        operating_system: device.os,
        device: device.device,

        // GEO
        city: geo?.city,
        state: geo?.region,
        country: geo?.country,
        zip_code: geo?.postal,
        geo_location: geo ? `${geo.latitude},${geo.longitude}` : null,
        geo_meta: geo,

        // Business
        business_name: user.business_name,
        business_number: user.business_number,
        for_business_name: user.for_business_name,
        for_business_number: user.for_business_number,

        // Meta
        created_user: user.user_name,
        created_user_id: user.user_catalog_id,
        created_user_name: user.user_name,
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
    | "phone_exists"
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
    roles_json:["Store Manager"]
  })
 

   if (insertError) {
  if (insertError?.details?.includes("user_mobile")) {
    return { status: "phone_exists", message: "Mobile number already registered" };
  }
  return { status: "failed", message: insertError?.message || "Failed to create user" };
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