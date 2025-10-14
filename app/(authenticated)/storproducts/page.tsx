/* eslint-disable */
"use client";

import * as React from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Search as SearchIcon,
  Plus,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { getWooProducts, deleteWooProduct } from "./actions";

import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

const stripHtml = (html?: string) =>
  html ? html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim() : "";

type WooImage = { src: string; alt?: string };
type Product = {
  id: number;
  name: string;
  price?: string;
  regular_price?: string;
  sale_price?: string;
  images: WooImage[];
  stock_status?: string;
  stock_quantity?: number | null;
  short_description?: string;
  description?: string;
};

export default function StorProductsPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const pageFromUrl = Number(sp.get("page") || "1");
  const searchFromUrl = sp.get("q") || "";

  const [page, setPage] = React.useState<number>(Math.max(1, pageFromUrl));
  const [q, setQ] = React.useState<string>(searchFromUrl);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [allPageData, setAllPageData] = React.useState<{ products: Product[]; pages: number }>({
    products: [],
    pages: 1,
  });

  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Product | null>(null);

  const load = React.useCallback(
    async (opts?: { page?: number; q?: string }) => {
      setLoading(true);
      setError(null);
      const nextPage = opts?.page ?? page;
      const nextQ = opts?.q ?? q;

      try {
        const res = await getWooProducts({ page: nextPage, perPage: 15, search: nextQ || undefined });
        setAllPageData({ products: res.products as Product[], pages: res.pages || 1 });

        const params = new URLSearchParams();
        if (nextPage > 1) params.set("page", String(nextPage));
        if (nextQ) params.set("q", nextQ);
        router.replace(`?${params.toString()}`);
      } catch (e: any) {
        setError(e.message || "Failed to load products");
      } finally {
        setLoading(false);
      }
    },
    [page, q, router]
  );

  React.useEffect(() => {
    setPage(Math.max(1, pageFromUrl));
    setQ(searchFromUrl);
  }, [pageFromUrl, searchFromUrl]);

  React.useEffect(() => {
    load({ page: Math.max(1, pageFromUrl), q: searchFromUrl });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visibleProducts = React.useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return allPageData.products;
    return allPageData.products.filter((p) => p.name.toLowerCase().includes(term));
  }, [q, allPageData.products]);

  const onSearchEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    const value = (e.currentTarget as HTMLInputElement).value.trim();
    setPage(1);
    load({ page: 1, q: value });
  };

  const renderPrice = (p: Product) => {
    const hasRegular = p.regular_price && Number(p.regular_price) > 0;
    const current = p.sale_price && Number(p.sale_price) > 0 ? p.sale_price : p.price;
    const hasCurrent = current && Number(current) > 0;

    return (
      <div className="flex items-center gap-2 text-sm">
        {hasRegular ? <span className="text-muted-foreground line-through">$ {p.regular_price}</span> : null}
        {hasCurrent ? <span className="font-medium">$ {current}</span> : !hasRegular ? <span>—</span> : null}
      </div>
    );
  };

  // Updated: only show qty badge if numeric; always show status
  const qtyStatusRow = (p: Product) => {
    const qty = typeof p.stock_quantity === "number" ? p.stock_quantity : null;
    const statusText = (p.stock_status || "unknown").replace(/_/g, " ");

    const statusColor =
      p.stock_status === "instock"
        ? "bg-green-100 text-green-700"
        : p.stock_status === "onbackorder"
        ? "bg-amber-100 text-amber-700"
        : p.stock_status === "outofstock"
        ? "bg-red-100 text-red-700"
        : "bg-muted text-muted-foreground";

    return (
      <div className="mt-3 flex items-center gap-2">
        {qty !== null ? (
          <span className="inline-flex min-w-[24px] justify-center items-center rounded-md bg-blue-600 px-2 py-0.5 text-xs font-medium text-white">
            {qty}
          </span>
        ) : null}
        <span className={`inline-flex rounded-md px-2 py-0.5 text-xs ${statusColor}`}>{statusText}</span>
      </div>
    );
  };

  const goTo = (p: number) => {
    const np = Math.min(Math.max(1, p), allPageData.pages || 1);
    setPage(np);
    load({ page: np, q });
  };

  const goCreate = () => router.push("/storproducts/product/new");
  const goEdit = (id: number) => router.push(`/storproducts/product/edit/${id}`);

  const requestDelete = (product: Product) => {
    setDeleteTarget(product);
    setConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const prev = allPageData.products;
    setAllPageData((d) => ({ ...d, products: d.products.filter((x) => x.id !== deleteTarget.id) }));
    setConfirmOpen(false);
    try {
      await deleteWooProduct(deleteTarget.id);
      toast.success("Product deleted successfully");
    } catch (e) {
      setAllPageData((d) => ({ ...d, products: prev }));
      toast.error("Delete failed");
    }
    setDeleteTarget(null);
  };

  // Sliding window pagination (max 5 buttons)
  const Pagination = () => {
    const total = allPageData.pages || 1;
    if (total <= 1 || visibleProducts.length === 0) return null;

    const maxWindow = 5;
    const half = Math.floor(maxWindow / 2);

    let start = Math.max(1, page - half);
    let end = start + maxWindow - 1;

    if (end > total) {
      end = total;
      start = Math.max(1, end - maxWindow + 1);
    }

    const pagesArray = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    return (
      <nav className="mt-6 flex items-center justify-center gap-1" aria-label="Pagination">
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => goTo(page - 1)}
          disabled={page <= 1}
          aria-label="Previous"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pagesArray.map((n) => (
          <Button
            key={n}
            variant={n === page ? "default" : "outline"}
            className="h-9 px-3"
            onClick={() => goTo(n)}
            aria-current={n === page ? "page" : undefined}
          >
            {n}
          </Button>
        ))}

        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9"
          onClick={() => goTo(page + 1)}
          disabled={page >= total}
          aria-label="Next"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </nav>
    );
  };

  return (
    <div className="w-full">
      <div className="mx-auto max-w-[800px] px-4 py-6">
        {/* Search + create */}
        <div className="mb-6 flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchEnter}
              placeholder="Search products by name"
              className="pl-9"
              aria-label="Search products"
            />
          </div>
          <Button className="h-9 w-9 p-0" onClick={goCreate} aria-label="Create">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : loading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <div className="flex gap-4 p-4">
                  <Skeleton className="h-28 w-28 rounded-md" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <>
            {visibleProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No products found.</p>
            ) : (
              <div className="space-y-4">
                {visibleProducts.map((p) => {
                  const img = p.images?.[0]?.src ?? "";
                  const alt = p.images?.[0]?.alt ?? p.name;
                  const description = stripHtml(p.short_description || p.description);

                  return (
                    <Card key={p.id} className="overflow-hidden">
                      <div className="flex gap-4 p-4">
                        <div className="w-28 shrink-0 flex flex-col">
                          <div className="relative h-28 w-28 rounded-md overflow-hidden">
                            {img ? (
                              <Image src={img} alt={alt} fill sizes="112px" className="object-contain" />
                            ) : (
                              <div className="h-full w-full bg-muted" />
                            )}
                          </div>
                          {qtyStatusRow(p)}
                        </div>

                        <div className="min-w-0 flex-1 flex flex-col">
                          <CardHeader className="p-0">
                            <CardTitle className="text-base truncate">{p.name}</CardTitle>
                            {renderPrice(p)}
                          </CardHeader>

                          <CardContent className="p-0 mt-2">
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {description || "No description"}
                            </p>
                          </CardContent>

                          <CardFooter className="p-0 mt-3">
                            <div className="ml-auto flex items-center gap-2">
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goEdit(p.id)} aria-label="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => requestDelete(p)} aria-label="Delete">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardFooter>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}

            <Pagination />
          </>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="sm:max-w-md rounded-lg p-4 shadow-md bg-white dark:bg-gray-800">
            <DialogHeader className="flex items-center gap-2">
              <AlertCircle className="h-6 w-6 text-red-500" />
              <DialogTitle className="text-md font-semibold text-gray-900 dark:text-gray-100">
                Confirm Deletion
              </DialogTitle>
            </DialogHeader>

            <div className="mt-2 text-gray-700 dark:text-gray-300 text-sm">
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
              {deleteTarget && (
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  ID: {deleteTarget.id}
                </div>
              )}
            </div>

            <DialogFooter className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition px-3 py-1.5 text-sm"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="bg-red-600 hover:bg-red-700 text-white transition px-3 py-1.5 text-sm"
                onClick={confirmDelete}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
