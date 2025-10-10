"use server";

import { unstable_noStore, revalidateTag } from "next/cache";
import { postgrest } from "@/lib/postgrest";
import { auth } from "@/auth";
import { getErrorMessage } from "@/lib/handle-error";

const PROFILE_TAG = "profile";
const PROFILE_BUSINESS_TAG = "profile-business";

type BusinessPayload = {
  business_name?: string | null;
  business_number?: string | null;
  business_address_1?: string | null;
  business_address_2?: string | null;
  business_city?: string | null;
  business_state?: string | null;
  business_postcode?: string | null;
  business_country?: string | null;
};

export async function getProfile() {
  unstable_noStore();
  try {
    const session = await auth();
    if (!session?.user?.user_email) {
      return { data: null, error: "Not authenticated" };
    }

    const { data, error } = await postgrest
      .from("user_catalog")
      .select(
        [
          "user_email",
          "first_name",
          "last_name",
          "full_name",
          "user_mobile",
          "status",
          "roles_json",
          "avatar_url",
          "business_name",
          "business_number",
          "for_business_name",
          "for_business_number",
          "business_address_1",
          "business_address_2",
          "business_city",
          "business_state",
          "business_postcode",
          "business_country",
        ].join(", ")
      )
      .eq("user_email", session.user.user_email)
      .maybeSingle();

    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

export async function updateBusiness(input: BusinessPayload) {
  unstable_noStore();
  try {
    const session = await auth();
    if (!session?.user?.user_email) {
      return { data: null, error: "Not authenticated" };
    }

    // Build updates object only from provided fields
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // 1) If business_name provided, set it and mirror to for_business_name
    if ("business_name" in input) {
      updates.business_name = input.business_name ?? null;
      updates.for_business_name = input.business_name ?? null;
    }

    // 2) If business_number provided, set it and mirror to for_business_number
    if ("business_number" in input) {
      updates.business_number = input.business_number ?? null;
      updates.for_business_number = input.business_number ?? null;
    }

    // 3) Other address fields if provided
    if ("business_address_1" in input)
      updates.business_address_1 = input.business_address_1 ?? null;
    if ("business_address_2" in input)
      updates.business_address_2 = input.business_address_2 ?? null;
    if ("business_city" in input)
      updates.business_city = input.business_city ?? null;
    if ("business_state" in input)
      updates.business_state = input.business_state ?? null;
    if ("business_postcode" in input)
      updates.business_postcode = input.business_postcode ?? null;
    if ("business_country" in input)
      updates.business_country = input.business_country ?? null;

    const { data, error } = await postgrest
      .from("user_catalog")
      .update(updates)
      .eq("user_email", session.user.user_email)
      .select(
        [
          "business_name",
          "business_number",
          "for_business_name",
          "for_business_number",
          "business_address_1",
          "business_address_2",
          "business_city",
          "business_state",
          "business_postcode",
          "business_country",
        ].join(", ")
      )
      .single();

    if (error) throw error;

    revalidateTag(PROFILE_TAG);
    revalidateTag(PROFILE_BUSINESS_TAG);

    return { data, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}

// Persist an already-uploaded avatar URL to avatar_url (pure DB; upload handled elsewhere)
export async function updateAvatarUrl(input: { avatar_url: string }) {
  unstable_noStore();
  try {
    const session = await auth();
    if (!session?.user?.user_email) {
      return { data: null, error: "Not authenticated" };
    }

    const { data, error } = await postgrest
      .from("user_catalog")
      .update({
        avatar_url: input.avatar_url,
        updated_at: new Date().toISOString(),
      })
      .eq("user_email", session.user.user_email)
      .select("avatar_url")
      .single();

    if (error) throw error;

    revalidateTag(PROFILE_TAG);
    return { data, error: null };
  } catch (err) {
    return { data: null, error: getErrorMessage(err) };
  }
}
