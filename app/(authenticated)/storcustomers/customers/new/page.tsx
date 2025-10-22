"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createCustomer, CustomerBilling } from "../../actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

const defaultBilling: CustomerBilling = {
  first_name: "",
  last_name: "",
  company: "",
  address_1: "",
  address_2: "",
  city: "",
  state: "",
  postcode: "",
  country: "",
  email: "",
  phone: "",
};

export default function NewCustomerPage() {
  const router = useRouter();
  const [billing, setBilling] = useState<CustomerBilling>({ ...defaultBilling });
  const [loading, setLoading] = useState(false);

  const handleChange = (field: keyof CustomerBilling, value: string) => {
    setBilling((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await createCustomer({
        email: billing.email || "",
        billing,
      });
      toast.success("Customer created");
      router.push("/storcustomers");
    } catch (err) {
      console.error(err);
      toast.error("Failed to create customer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-8 border border-gray-200 rounded-xl mb-2">
      {/* Header bar with title and go back button */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">New Customer</h1>
        <Button
          variant="outline"
          onClick={() => router.push("/storcustomers")}
          className="flex items-center gap-1"
        >
          <ArrowLeft size={16} />
          Go Back
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          placeholder="First Name"
          value={billing.first_name}
          onChange={(e) => handleChange("first_name", e.target.value)}
        />
        <Input
          placeholder="Last Name"
          value={billing.last_name}
          onChange={(e) => handleChange("last_name", e.target.value)}
        />
        <Input
          placeholder="Email"
          value={billing.email}
          onChange={(e) => handleChange("email", e.target.value)}
        />
        <Input
          placeholder="Phone"
          value={billing.phone}
          onChange={(e) => handleChange("phone", e.target.value)}
        />
        <Input
          placeholder="Address 1"
          value={billing.address_1}
          onChange={(e) => handleChange("address_1", e.target.value)}
        />
        <Input
          placeholder="Address 2"
          value={billing.address_2}
          onChange={(e) => handleChange("address_2", e.target.value)}
        />
        <Input
          placeholder="Company"
          value={billing.company}
          onChange={(e) => handleChange("company", e.target.value)}
        />
        <Input
          placeholder="City"
          value={billing.city}
          onChange={(e) => handleChange("city", e.target.value)}
        />
        <Input
          placeholder="State"
          value={billing.state}
          onChange={(e) => handleChange("state", e.target.value)}
        />
        <Input
          placeholder="Postcode"
          value={billing.postcode}
          onChange={(e) => handleChange("postcode", e.target.value)}
        />
        <Input
          placeholder="Country"
          value={billing.country}
          onChange={(e) => handleChange("country", e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button onClick={() => router.push("/storcustomers")} disabled={loading} variant="outline">
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={loading}>
          Save
        </Button>
      </div>
    </div>
  );
}
