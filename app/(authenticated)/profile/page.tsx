"use client";

import React, { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getProfile, updateBusiness, updateAvatarUrl } from "./_lib/action";
import { toast } from "sonner";

type Profile = {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  user_email: string;
  user_mobile: string | null;
  status: string | null;
  roles_json?: string[] | string | null;
  avatar_url?: string | null;

  business_name?: string | null;
  business_number?: string | null;
  for_business_name?: string | null;
  for_business_number?: string | null;

  business_address_1?: string | null;
  business_address_2?: string | null;
  business_city?: string | null;
  business_state?: string | null;
  business_postcode?: string | null;
  business_country?: string | null;
};

type BusinessState = {
  business_name: string;
  business_number: string;
  business_address_1: string;
  business_address_2: string;
  business_city: string;
  business_state: string;
  business_postcode: string;
  business_country: string;
};

type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

function isProfile(x: unknown): x is Profile {
  if (!x || typeof x !== "object") return false;
  return "user_email" in (x as any);
}

function isBusinessSubset(x: unknown): x is Partial<BusinessState> {
  return !!x && typeof x === "object";
}

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [biz, setBiz] = useState<BusinessState>({
    business_name: "",
    business_number: "",
    business_address_1: "",
    business_address_2: "",
    business_city: "",
    business_state: "",
    business_postcode: "",
    business_country: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    (async () => {
      const res = (await getProfile()) as ActionResult<Profile>;
      if (res.error) {
        setErrMsg(res.error);
        toast.error(res.error);
      } else if (res.data && isProfile(res.data)) {
        const p = res.data;
        setProfile(p);
        setBiz({
          business_name: p.business_name || "",
          business_number: p.business_number || "",
          business_address_1: p.business_address_1 || "",
          business_address_2: p.business_address_2 || "",
          business_city: p.business_city || "",
          business_state: p.business_state || "",
          business_postcode: p.business_postcode || "",
          business_country: p.business_country || "",
        });
      }
      setLoading(false);
    })();
  }, []);

  const fullName =
    profile?.full_name && profile.full_name.trim().length > 0
      ? profile.full_name
      : `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim();

  const initials =
    (profile?.first_name?.[0] ?? "").toUpperCase() +
    (profile?.last_name?.[0] ?? "").toUpperCase();

  async function handleSave() {
    setSaving(true);
    setErrMsg(null);

    const res = (await updateBusiness(biz)) as ActionResult<
      Partial<BusinessState> & {
        for_business_name?: string | null;
        for_business_number?: string | null;
      }
    >;

    if (res.error) {
      setErrMsg(res.error);
      toast.error(res.error);
    } else if (res.data && isBusinessSubset(res.data)) {
      setProfile((prev) => (prev ? { ...prev, ...res.data } : prev));
      setBiz((prev) => ({
        ...prev,
        business_name:
          (res.data as any).business_name ?? prev.business_name,
        business_number:
          (res.data as any).business_number ?? prev.business_number,
      }));
      toast.success("Business details updated.");
    } else {
      toast.message("No changes to save.");
    }

    setSaving(false);
  }

  // Replace with real upload; must return a public URL string
  async function uploadFileAndGetUrl(file: File): Promise<string | null> {
    // Example:
    // const fd = new FormData(); fd.set("file", file);
    // const r = await fetch("/api/upload-avatar", { method: "POST", body: fd });
    // if (!r.ok) return null; const j = await r.json(); return j.url ?? null;
    return null;
  }

  async function handleChangePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const inputEl = fileRef.current;
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    setErrMsg(null);

    const url = await uploadFileAndGetUrl(file);
    if (url) {
      const res = (await updateAvatarUrl({ avatar_url: url })) as ActionResult<{
        avatar_url: string | null;
      }>;
      if (res.error) {
        setErrMsg(res.error);
        toast.error(res.error);
      } else if (res.data) {
        setProfile((prev) =>
          prev ? { ...prev, avatar_url: res.data.avatar_url } : prev
        );
        toast.success("Profile photo updated.");
      }
    } else {
      toast.info("Upload not implemented.");
    }

    queueMicrotask(() => {
      if (inputEl) inputEl.value = "";
    });

    setAvatarUploading(false);
  }

  if (loading) {
    return (
      <div className="max-w-[800px] mx-auto px-4 pb-12">
        <div className="flex flex-col items-center gap-3 mt-10">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="mt-10 space-y-6">
          <Card className="shadow-sm border border-border/60">
            <CardContent className="py-8 space-y-4">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </CardContent>
          </Card>
          <Card className="shadow-sm border border-border/60">
            <CardContent className="py-8 space-y-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-[800px] mx-auto px-4 pb-12 text-center mt-10">
        {errMsg ?? "No profile found."}
      </div>
    );
  }

  const rolesDisplay =
    Array.isArray(profile.roles_json)
      ? profile.roles_json.filter(Boolean).join(", ")
      : typeof profile.roles_json === "string"
      ? profile.roles_json
      : "—";

  return (
    <div className="max-w-[800px] mx-auto px-4 pb-12">
      {/* Header */}
      <header className="flex flex-col items-center mt-10">
        <Avatar className="h-24 w-24 ring-2 ring-black/5 shadow-sm">
          <AvatarImage
            src={profile.avatar_url ?? undefined}
            alt={fullName || "User"}
            onError={(ev) => {
              (ev.target as HTMLImageElement).style.display = "none";
            }}
          />
          <AvatarFallback className="text-lg font-medium text-white bg-gradient-to-br from-zinc-400 via-zinc-500 to-zinc-700">
            {initials || "US"}
          </AvatarFallback>
        </Avatar>

        <div className="mt-3 flex items-center gap-3">
          <input
            ref={fileRef}
            id="avatarFile"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleChangePhoto}
          />
          <Button
            variant="secondary"
            onClick={() => fileRef.current?.click()}
            disabled={avatarUploading}
          >
            {avatarUploading ? "Uploading..." : "Change Photo"}
          </Button>
        </div>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {fullName || "Profile"}
        </h1>
        {/* <p className="mt-1 text-sm text-muted-foreground">
          {profile.user_email}
        </p> */}
      </header>

      {/* Personal Information */}
      <section className="mt-10">
        <Card className="shadow-sm border border-border/60">
          <CardContent className="py-8 space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">
                Personal Information
              </h2>
              <p className="text-sm text-muted-foreground">
                Account-managed fields.
              </p>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={fullName} readOnly />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={profile.user_email} readOnly />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="role">Roles</Label>
                <Input id="role" value={rolesDisplay} readOnly />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="status">Status</Label>
                <Input id="status" value={profile.status || "N/A"} readOnly />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Business Information */}
      <section className="mt-8 mb-12">
        <Card className="shadow-sm border border-border/60">
          <CardContent className="py-8 space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight">
                Business Information
              </h2>
              <p className="text-sm text-muted-foreground">
                Update business and address details.
              </p>
            </div>

            <div className="grid gap-5">
              <div className="grid gap-1.5">
                <Label htmlFor="bizNumber">Business Number</Label>
                <Input
                  id="bizNumber"
                  value={biz.business_number}
                  onChange={(e) =>
                    setBiz({ ...biz, business_number: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="bizName">Business Name</Label>
                <Input
                  id="bizName"
                  value={biz.business_name}
                  onChange={(e) =>
                    setBiz({ ...biz, business_name: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="addr1">Address Line 1</Label>
                <Input
                  id="addr1"
                  value={biz.business_address_1}
                  onChange={(e) =>
                    setBiz({ ...biz, business_address_1: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="addr2">Address Line 2</Label>
                <Input
                  id="addr2"
                  value={biz.business_address_2}
                  onChange={(e) =>
                    setBiz({ ...biz, business_address_2: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="grid gap-1.5">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={biz.business_city}
                    onChange={(e) =>
                      setBiz({ ...biz, business_city: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="state">State / Province</Label>
                  <Input
                    id="state"
                    value={biz.business_state}
                    onChange={(e) =>
                      setBiz({ ...biz, business_state: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="grid gap-1.5">
                  <Label htmlFor="postcode">Postcode / ZIP</Label>
                  <Input
                    id="postcode"
                    value={biz.business_postcode}
                    onChange={(e) =>
                      setBiz({ ...biz, business_postcode: e.target.value })
                    }
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={biz.business_country}
                    onChange={(e) =>
                      setBiz({ ...biz, business_country: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
