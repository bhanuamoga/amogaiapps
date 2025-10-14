/* eslint-disable */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  getWooProductById,
  updateWooProduct,
  getWooCategories,
  uploadMediaFromClient,
} from "../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Image as ImageIcon, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

type Category = { id: number; name: string };

const productSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    regular_price: z
      .string()
      .min(1, "Regular price is required")
      .refine((v) => !Number.isNaN(Number(v)), "Regular price must be a number")
      .refine((v) => Number(v) >= 0, "Regular price must be >= 0"),
    sale_price: z
      .string()
      .min(1, "Sale price is required")
      .refine((v) => !Number.isNaN(Number(v)), "Sale price must be a number")
      .refine((v) => Number(v) >= 0, "Sale price must be >= 0"),
    stock_quantity: z
      .string()
      .optional()
      .transform((v) => (v ? v : ""))
      .refine((v) => v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), {
        message: "Stock qty must be a non-negative number",
      }),
    stock_status: z.enum(["instock", "outofstock", "onbackorder"]),
    image: z.string().min(1, "Product image is required"),
    description: z.string().min(1, "Description is required"),
    categoryId: z.union([z.number(), z.string()]).optional(),
  })
  .refine(
    (data) =>
      data.sale_price === "" ||
      data.regular_price === "" ||
      Number(data.sale_price) <= Number(data.regular_price),
    {
      message: "Sale price cannot be greater than regular price",
      path: ["sale_price"],
    }
  );

type FormValues = z.infer<typeof productSchema>;

export default function EditProducts({ id }: { id: string }) {
  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
    reset,
    trigger,
  } = useForm<FormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      regular_price: "",
      sale_price: "",
      stock_quantity: "",
      stock_status: "instock",
      image: "",
      description: "",
      categoryId: "",
    },
    mode: "onChange",
  });

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = React.useState<number | "">("");
  const [loading, setLoading] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [localPreview, setLocalPreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [p, cats] = await Promise.all([
          getWooProductById(id),
          getWooCategories({ perPage: 100 }),
        ]);

        if (!on) return;

        const imageUrl =
          Array.isArray(p.images) && p.images[0]?.src ? p.images[0].src : "";

        reset({
          name: p.name || "",
          regular_price: p.regular_price || "",
          sale_price: p.sale_price || "",
          stock_quantity:
            typeof p.stock_quantity === "number" ? String(p.stock_quantity) : "",
          stock_status: (p.stock_status as any) || "instock",
          image: imageUrl,
          description: p.short_description || p.description || "",
          categoryId: "",
        });

        setCategories(cats.map((c: any) => ({ id: c.id, name: c.name })));

        const pCats = Array.isArray((p as any).categories) ? (p as any).categories : [];
        setSelectedCat(pCats[0]?.id ?? "");
      } catch (e: any) {
        const msg = e?.message || "Failed to load product";
        setError(msg);
        toast.error("Load failed", { description: msg });
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      on = false;
    };
  }, [id, reset]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setLocalPreview(previewUrl);
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await uploadMediaFromClient({
        fileName: file.name,
        type: file.type || "image/jpeg",
        base64,
      });
      if (!res?.url) throw new Error("Upload did not return a URL");
      setValue("image", res.url, { shouldValidate: true, shouldTouch: true, shouldDirty: true });
      await trigger("image");
      toast.success("Image uploaded", { description: "Image set from local file." });
    } catch (err: any) {
      URL.revokeObjectURL(previewUrl);
      setLocalPreview(null);
      toast.error("Upload failed", { description: err?.message || "Could not upload" });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = () => {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview(null);
    setValue("image", "", { shouldValidate: true, shouldTouch: true, shouldDirty: true });
    const input = document.getElementById("edit-product-image-file") as HTMLInputElement | null;
    if (input) input.value = "";
  };

  const onSubmit = async (data: FormValues) => {
    setPending(true);
    setError(null);
    try {
      if (!data.image) {
        toast.error("Image required", { description: "Please upload or paste an image URL." });
        return;
      }

      await updateWooProduct(id, {
        name: data.name,
        regular_price: data.regular_price || undefined,
        sale_price: data.sale_price || undefined,
        stock_quantity: data.stock_quantity ? Number(data.stock_quantity) : null,
        stock_status: data.stock_status,
        description: data.description ?? undefined,
        image: data.image || undefined,
        categories: selectedCat ? [Number(selectedCat)] : undefined,
        status: "publish",
      });

      toast.success("Product updated", { description: "Changes saved successfully." });
      router.push("/storproducts");
    } catch (err: any) {
      const msg = err?.message || "Failed to update";
      setError(msg);
      toast.error("Update failed", { description: msg });
    } finally {
      setPending(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading product…</p>;

  return (
    <Card className="max-w-3xl">
      {/* Top-right back button */}
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-xl">Edit product</CardTitle>
        <Button type="button" variant="ghost" className="gap-2" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
          Go back
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? <p className="mb-2 text-sm text-destructive">{error}</p> : null}

        <form id="edit-product-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input {...register("name")} aria-invalid={!!errors.name} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Regular Price</Label>
              <Input type="number" inputMode="decimal" {...register("regular_price")} aria-invalid={!!errors.regular_price} />
              {errors.regular_price && <p className="text-xs text-destructive">{errors.regular_price.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Sale Price</Label>
              <Input type="number" inputMode="decimal" {...register("sale_price")} aria-invalid={!!errors.sale_price} />
              {errors.sale_price && <p className="text-xs text-destructive">{errors.sale_price.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Stock Quantity</Label>
              <Input type="number" inputMode="numeric" {...register("stock_quantity")} aria-invalid={!!errors.stock_quantity} />
              {errors.stock_quantity && <p className="text-xs text-destructive">{errors.stock_quantity.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                {...register("stock_status")}
                defaultValue="instock"
                aria-invalid={!!errors.stock_status}
              >
                <option value="instock">In stock</option>
                <option value="outofstock">Out of stock</option>
                <option value="onbackorder">On backorder</option>
              </select>
              {errors.stock_status && (
                <p className="text-xs text-destructive">{errors.stock_status.message as string}</p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Category</Label>
            <select
              className="h-10 rounded-md border bg-background px-3 text-sm"
              value={selectedCat === "" ? "" : String(selectedCat)}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : "";
                setSelectedCat(v);
                setValue("categoryId", v as any, { shouldValidate: false });
              }}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Image section identical to create */}
          <div className="grid gap-2">
            <Label>Product Image</Label>

            <label
              className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
                uploading ? "opacity-50 cursor-wait" : "hover:border-primary hover:bg-primary/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {localPreview || getValues("image") ? "Change image" : "Click to select or drag an image"}
                </span>
              </div>

              <Input
                id="edit-product-image-file"
                type="file"
                accept="image/*"
                onChange={onPickFile}
                disabled={uploading}
                className="hidden"
              />

              {(localPreview || getValues("image")) && (
                <div className="relative w-32 h-32 rounded overflow-hidden border shadow-sm mt-2">
                  <img
                    src={localPreview || getValues("image")}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="absolute top-1 right-1 p-1 h-6 w-6 text-destructive rounded-full bg-white/80 hover:bg-white"
                    onClick={removeImage}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </label>

            <Input
              placeholder="Or paste an image URL (https://...)"
              {...register("image")}
              onChange={(e) => setValue("image", e.target.value, { shouldValidate: true })}
              aria-invalid={!!errors.image}
            />
            {errors.image && <p className="text-xs text-destructive">{errors.image.message}</p>}
          </div>

          {/* Restored required Description field */}
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea rows={5} {...register("description")} aria-invalid={!!errors.description} />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>
        </form>
      </CardContent>

      {/* Bottom-right: Cancel + Update */}
      <CardFooter className="justify-end gap-2 border-t py-3">
        <Button type="button" variant="outline" onClick={() => router.push("/storproducts")}>
          Cancel
        </Button>
        <Button type="submit" form="edit-product-form" disabled={pending || uploading || isSubmitting}>
          {pending || isSubmitting ? "Updating..." : "Update"}
        </Button>
      </CardFooter>
    </Card>
  );
}

async function fileToBase64(file: File) {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return typeof window === "undefined" ? Buffer.from(binary, "binary").toString("base64") : btoa(binary);
}
