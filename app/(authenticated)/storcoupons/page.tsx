"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCoupons, deleteCoupon } from "./actions"; // ✅ import deleteCoupon
import { toast } from "sonner"; // ✅ sonner toast

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Plus,
  Tag,
  FileText,
  Percent,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  Trash,
} from "lucide-react";

export default function StoreCouponsPage() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 5;
  const router = useRouter();

  const fetchCoupons = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getCoupons();
      if (Array.isArray(response)) {
        setCoupons(response);
        setFiltered(response);
      } else {
        setError("Failed to load coupons");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load coupons");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCoupons();
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchCoupons();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    const filteredList = coupons.filter((c) =>
      c.code?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFiltered(filteredList);
    setPage(1);
  }, [searchTerm, coupons]);

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  // ✅ Direct delete with Sonner toast
  const handleDelete = async (id: number) => {
    try {
      await deleteCoupon(id);
      setCoupons((prev) => prev.filter((c) => c.id !== id));
      setFiltered((prev) => prev.filter((c) => c.id !== id));
      toast.success("Coupon deleted successfully"); // ✅ sonner toast
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete coupon"); // ✅ error toast
    }
  };

  return (
    <div className="flex justify-center p-6">
      <div className="w-full max-w-[800px] space-y-6">
        {/* Searchbar + New Button */}
        <div className="flex items-center gap-2 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4" />
            <Input
              placeholder="Search coupons..."
              className="pl-8 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={loading}
            />
          </div>
          <Button onClick={() => router.push("/storcoupons/coupons/new")}>
            <Plus className="h-4 w-4" />
          
          </Button>
        </div>

        {/* Loading/Error */}
        {loading && <p className="text-center">Loading coupons...</p>}
        {error && <p className="text-center text-red-600">{error}</p>}

        {/* Coupon Cards */}
        {!loading && !error && paginated.length === 0 && (
          <p className="text-center">No coupons found.</p>
        )}

        {!loading &&
          !error &&
          paginated.map((coupon) => (
            <Card key={coupon.id} className="transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  {coupon.code}
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">Description:</span>
                  <span>{coupon.description || "—"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  <span className="font-medium">Amount:</span>
                  <span>{coupon.amount || "_"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Created:</span>
                  <span>
                    {coupon.date_created
                      ? new Date(coupon.date_created).toLocaleDateString()
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">Expiry:</span>
                  <span>
                    {coupon.date_expires || coupon.date_expires_gmt
                      ? new Date(
                          new Date(
                            coupon.date_expires || coupon.date_expires_gmt
                          ).getTime() -
                            new Date(
                              coupon.date_expires || coupon.date_expires_gmt
                            ).getTimezoneOffset() *
                              60000
                        ).toLocaleDateString()
                      : "No expiry"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {coupon.status === "publish" ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  <span className="font-medium">Status:</span>
                  <span>{coupon.status || "unknown"}</span>
                </div>
              </CardContent>

              <CardFooter className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    router.push(`/storcoupons/coupons/edit/${coupon.id}`)
                  }
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleDelete(coupon.id!)}
                >
                  <Trash className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex justify-center items-center gap-3 pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Prev
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
              
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
