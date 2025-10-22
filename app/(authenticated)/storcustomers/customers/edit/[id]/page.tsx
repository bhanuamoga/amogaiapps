"use client"

import React, { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  getAllCustomers,
  updateCustomer,
  Customer,
  CustomerBilling,
  CustomerShipping,
} from "../../../actions"
import { ArrowLeft } from "lucide-react"

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
}

const defaultShipping: CustomerShipping = {
  first_name: "",
  last_name: "",
  company: "",
  address_1: "",
  address_2: "",
  city: "",
  state: "",
  postcode: "",
  country: "",
}

export default function EditCustomerPage() {
  const router = useRouter()
  const params = useParams()
  const customerId = Number(params.id)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const form = useForm<Partial<Customer>>({
    defaultValues: {
      billing: defaultBilling,
      shipping: defaultShipping,
    },
  })

  useEffect(() => {
    const fetchCustomer = async () => {
      setLoading(true)
      try {
        const data = await getAllCustomers()
        const c = data.find((c) => c.id === customerId)
        if (!c) {
          toast.error("Customer not found")
          router.push("/storcustomers")
          return
        }
        // If role is subscriber, show toast and redirect
        if (c.role === "subscriber") {
          toast.error("Subscriber role has no access to edit customer")
          router.push("/storcustomers")
          return
        }
        form.reset({
          ...c,
          billing: { ...defaultBilling, ...(c.billing || {}) },
          shipping: { ...defaultShipping, ...(c.shipping || {}) },
        })
      } catch (err) {
        console.error(err)
        toast.error("Failed to fetch customer")
        router.push("/storcustomers")
      } finally {
        setLoading(false)
      }
    }
    fetchCustomer()
  }, [customerId, router, form])

  const onSubmit = async (values: Partial<Customer>) => {
    setSaving(true)
    try {
      await updateCustomer(customerId, values)
      toast.success("Customer details are updated successfully")
      router.push("/storcustomers")
    } catch (err) {
      console.error(err)
      toast.error("Failed to update customer")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p>Loading...</p>

  return (
    <div className="max-w-3xl mx-auto p-8 border border-gray-200 rounded-xl mb-2">
      {/* Header bar with title and go back button */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Edit Customer</h1>
        <Button
          variant="outline"
          onClick={() => router.push("/storcustomers")}
          className="flex items-center gap-1"
        >
          <ArrowLeft size={16} />
          Go Back
        </Button>
      </div>

      <Form {...form}>
        {/* Basic Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* Role dropdown */}
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Role</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="block w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select role</option>
                    <option value="customer">Customer</option>
                    <option value="subscriber">Subscriber</option>
                    <option value="shop_manager">Shop Manager</option>
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Billing */}
        <h2 className="mt-6 mb-2 font-semibold">Billing</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.keys(defaultBilling).map((key) => (
            <FormField
              key={key}
              control={form.control}
              name={`billing.${key}` as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{key.replace("_", " ").toUpperCase()}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        {/* Shipping */}
        <h2 className="mt-6 mb-2 font-semibold">Shipping</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {Object.keys(defaultShipping).map((key) => (
            <FormField
              key={key}
              control={form.control}
              name={`shipping.${key}` as any}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{key.replace("_", " ").toUpperCase()}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          ))}
        </div>

        {/* Save and cancel buttons */}
        <div className="flex justify-end gap-2 mt-4">
          <Button
            onClick={() => router.push("/storcustomers")}
            disabled={saving}
            variant="outline"
          >
            Cancel
          </Button>
          <Button onClick={form.handleSubmit(onSubmit)} disabled={saving}>
            Save
          </Button>
        </div>
      </Form>
    </div>
  )
}
