"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrompt, useUpdatePrompt, useUserSearch } from "@/hooks/langchin-agent/usePrompts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Loader2, Search, User, Trash2 } from "lucide-react";
import type { PromptUpdateRequest, UserSearchResult } from "@/types/prompts";
import React from "react";

const frequencies = ["hourly", "daily", "weekly", "monthly", "yearly", "special"];
const timezones = ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Tokyo"];

export default function EditPromptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const router = useRouter();
  const promptId = parseInt(id);

  const { data: prompt, isLoading, error } = usePrompt(promptId);
  const updatePromptMutation = useUpdatePrompt();

  const [formData, setFormData] = useState<PromptUpdateRequest>({
    id: promptId,
    title: "",
    description: "",
    remarks: "",
    status: "active",
    isScheduled: false,
    frequency: "daily",
    scheduleTime: "09:00",
    timezone: "UTC",
    startDate: "",
    endDate: "",
    hourlyInterval: 1,
    selectedWeekdays: [],
    dayOfMonth: 1,
    startMonth: 1,
    endMonth: 12,
    selectedYear: new Date().getFullYear(),
    selectedMonth: 1,
    selectedDay: 1,
    specificDates: [],
    deliveryOptions: {
      aiChat: true,
      notifier: false,
      email: false,
      chat: false,
    },
    targetUserIds: [],
    targetAllUsers: true,
    promptGroup: "general_prompt",
  });

  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);

  // Load prompt data when available
  useEffect(() => {
    if (prompt) {
      setFormData({
        id: promptId,
        title: prompt.title,
        description: prompt.description,
        remarks: prompt.remarks || "",
        status: prompt.status,
        isScheduled: prompt.isScheduled,
        frequency: prompt.frequency,
        scheduleTime: prompt.scheduleTime || "09:00",
        timezone: prompt.timezone,
        startDate: prompt.startDate || "",
        endDate: prompt.endDate || "",
        hourlyInterval: prompt.hourlyInterval || 1,
        selectedWeekdays: prompt.selectedWeekdays || [],
        dayOfMonth: prompt.dayOfMonth || 1,
        startMonth: prompt.startMonth || 1,
        endMonth: prompt.endMonth || 12,
        selectedYear: prompt.selectedYear || new Date().getFullYear(),
        selectedMonth: prompt.selectedMonth || 1,
        selectedDay: prompt.selectedDay || 1,
        specificDates: prompt.specificDates || [],
        deliveryOptions: prompt.deliveryOptions || {
          aiChat: true,
          notifier: false,
          email: false,
          chat: false,
        },
        targetUserIds: prompt.targetUserIds || [],
        targetAllUsers: prompt.targetAllUsers,
        promptGroup: prompt.promptGroup,
      });
    }
  }, [prompt, promptId]);

  // Search for users
  const { data: foundUsers = [], isLoading: isSearchingUsersData } = useUserSearch(
    userSearchQuery,
    selectedUsers.map(u => u.user_catalog_id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title || !formData.description) {
      alert("Title and description are required");
      return;
    }

    // Clean up the form data - convert empty strings to undefined for date fields
    const cleanedFormData = {
      ...formData,
      startDate: formData.startDate && formData.startDate.trim() !== "" ? formData.startDate : undefined,
      endDate: formData.endDate && formData.endDate.trim() !== "" ? formData.endDate : undefined,
    };

    try {
      await updatePromptMutation.mutateAsync(cleanedFormData);
      router.push("/chatwithwoodata/woo-prompt-list");
    } catch (error) {
      console.error("Failed to update prompt:", error);
    }
  };

  const handleClose = () => {
    router.push("/chatwithwoodata/woo-prompt-list");
  };

  const updateFormData = (field: keyof PromptUpdateRequest, value: string | number | boolean | string[] | number[] | boolean[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateDeliveryOption = (option: keyof typeof formData.deliveryOptions, value: boolean) => {
    setFormData(prev => ({
      ...prev,
      deliveryOptions: {
        ...prev.deliveryOptions,
        [option]: value,
      },
    }));
  };

  const toggleWeekday = (day: number) => {
    const currentWeekdays = formData.selectedWeekdays || [];
    const newWeekdays = currentWeekdays.includes(day)
      ? currentWeekdays.filter(d => d !== day)
      : [...currentWeekdays, day];
    updateFormData("selectedWeekdays", newWeekdays);
  };

  const handleUserSelect = (user: UserSearchResult) => {
    if (!selectedUsers.find(u => u.user_catalog_id === user.user_catalog_id)) {
      setSelectedUsers(prev => [...prev, user]);
      updateFormData("targetUserIds", [...(formData.targetUserIds || []), user.user_catalog_id]);
    }
    setUserSearchQuery("");
  };

  const handleUserRemove = (userId: number) => {
    setSelectedUsers(prev => prev.filter(u => u.user_catalog_id !== userId));
    updateFormData("targetUserIds", (formData.targetUserIds || []).filter(id => id !== userId));
  };

  const weekdays = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !prompt) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-medium mb-2">Prompt not found</h3>
          <p className="text-muted-foreground">{error?.message || "The prompt you're looking for doesn't exist"}</p>
          <Button onClick={handleClose} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-3xl">
        {/* Header with Close Button */}
        <div className="mb-8 flex items-center justify-end">
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => updateFormData("title", e.target.value)}
              placeholder="Enter prompt title"
              required
            />
          </div>

          {/* Description / Prompt Text */}
          <div className="space-y-2">
            <Label htmlFor="description">Description / Prompt Text *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => updateFormData("description", e.target.value)}
              placeholder="Enter the prompt text that will be executed"
              rows={6}
              className="resize-none"
              required
            />
          </div>

          {/* Remarks */}
          <div className="space-y-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={formData.remarks}
              onChange={(e) => updateFormData("remarks", e.target.value)}
              placeholder="Enter any additional notes or remarks"
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Enable Scheduled Execution */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="scheduled"
              checked={formData.isScheduled}
              onCheckedChange={(checked) => updateFormData("isScheduled", checked)}
            />
            <Label htmlFor="scheduled" className="cursor-pointer font-normal">
              Enable Scheduled Execution
            </Label>
          </div>

          {formData.isScheduled && (
            <>
              {/* Frequency */}
              <div className="space-y-2">
                <Label>Frequency</Label>
                <div className="flex flex-wrap gap-2">
                  {frequencies.map((freq) => (
                    <Button
                      key={freq}
                      type="button"
                      variant={formData.frequency === freq ? "default" : "outline"}
                      onClick={() => updateFormData("frequency", freq)}
                      className="min-w-[100px] flex-1"
                    >
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Frequency-specific settings */}
              {formData.frequency === "hourly" && (
                <div className="space-y-2">
                  <Label htmlFor="hourly-interval">Hourly Interval</Label>
                  <Input
                    id="hourly-interval"
                    type="number"
                    min="1"
                    max="24"
                    value={formData.hourlyInterval}
                    onChange={(e) => updateFormData("hourlyInterval", parseInt(e.target.value))}
                  />
                </div>
              )}

              {formData.frequency === "weekly" && (
                <div className="space-y-2">
                  <Label>Selected Weekdays</Label>
                  <div className="flex flex-wrap gap-2">
                    {weekdays.map((day) => (
                      <Button
                        key={day.value}
                        type="button"
                        variant={formData.selectedWeekdays?.includes(day.value) ? "default" : "outline"}
                        onClick={() => toggleWeekday(day.value)}
                        className="min-w-[100px]"
                      >
                        {day.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {formData.frequency === "monthly" && (
                <div className="space-y-2">
                  <Label htmlFor="day-of-month">Day of Month</Label>
                  <Input
                    id="day-of-month"
                    type="number"
                    min="1"
                    max="31"
                    value={formData.dayOfMonth}
                    onChange={(e) => updateFormData("dayOfMonth", parseInt(e.target.value))}
                  />
                </div>
              )}

              {formData.frequency === "yearly" && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="start-month">Start Month</Label>
                      <Input
                        id="start-month"
                        type="number"
                        min="1"
                        max="12"
                        value={formData.startMonth}
                        onChange={(e) => updateFormData("startMonth", parseInt(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end-month">End Month</Label>
                      <Input
                        id="end-month"
                        type="number"
                        min="1"
                        max="12"
                        value={formData.endMonth}
                        onChange={(e) => updateFormData("endMonth", parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Execution Time */}
              <div className="space-y-2">
                <Label htmlFor="execution-time">Execution Time (HH:MM)</Label>
                <Input
                  id="execution-time"
                  type="time"
                  value={formData.scheduleTime}
                  onChange={(e) => updateFormData("scheduleTime", e.target.value)}
                />
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <Label>Timezone</Label>
                <select
                  value={formData.timezone}
                  onChange={(e) => updateFormData("timezone", e.target.value)}
                  className="w-full p-2 border border-input rounded-md"
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start and End Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-date">Start Date (Optional)</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => updateFormData("startDate", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date (Optional)</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => updateFormData("endDate", e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          {/* Delivery Options */}
          <div className="space-y-3">
            <Label>Delivery Options</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ai-chat"
                  checked={formData.deliveryOptions.aiChat}
                  onCheckedChange={(checked) => updateDeliveryOption("aiChat", checked as boolean)}
                />
                <Label htmlFor="ai-chat" className="cursor-pointer font-normal">
                  Send on AI Chat
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="notifier"
                  checked={formData.deliveryOptions.notifier}
                  onCheckedChange={(checked) => updateDeliveryOption("notifier", checked as boolean)}
                />
                <Label htmlFor="notifier" className="cursor-pointer font-normal">
                  Send on Notifier
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="email"
                  checked={formData.deliveryOptions.email}
                  onCheckedChange={(checked) => updateDeliveryOption("email", checked as boolean)}
                />
                <Label htmlFor="email" className="cursor-pointer font-normal">
                  Send as Email
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="chat"
                  checked={formData.deliveryOptions.chat}
                  onCheckedChange={(checked) => updateDeliveryOption("chat", checked as boolean)}
                />
                <Label htmlFor="chat" className="cursor-pointer font-normal">
                  Send on Chat
                </Label>
              </div>
            </div>
          </div>

          {/* Target Users */}
          <div className="space-y-3">
            <Label>Target Users</Label>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="all-users"
                checked={formData.targetAllUsers}
                onCheckedChange={(checked) => updateFormData("targetAllUsers", checked)}
              />
              <Label htmlFor="all-users" className="cursor-pointer font-normal">
                Send to All Users
              </Label>
            </div>

            {!formData.targetAllUsers && (
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    placeholder="Search users by name or email..."
                    className="pl-9"
                  />
                  {isSearchingUsersData && <Loader2 className="absolute right-3 top-3.5 h-4 w-4 animate-spin" />}
                </div>

                {foundUsers.length > 0 && (
                  <div className="border border-border rounded-md bg-card shadow-lg max-h-40 overflow-y-auto">
                    {foundUsers.map((user) => (
                      <div
                        key={user.user_catalog_id}
                        className="p-3 border-b border-border last:border-b-0 hover:bg-muted cursor-pointer"
                        onClick={() => handleUserSelect(user)}
                      >
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{user.first_name} {user.last_name}</p>
                            <p className="text-xs text-muted-foreground">{user.user_email}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Selected Users ({selectedUsers.length}):</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedUsers.map((user) => (
                      <div
                        key={user.user_catalog_id}
                        className="flex items-center bg-secondary rounded-full pl-3 pr-2 py-1.5"
                      >
                        <User className="h-3 w-3 text-secondary-foreground mr-2" />
                        <span className="text-secondary-foreground text-sm font-medium">
                          {user.first_name} {user.last_name}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 ml-2 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => handleUserRemove(user.user_catalog_id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="active"
              checked={formData.status === "active"}
              onCheckedChange={(checked) => updateFormData("status", checked ? "active" : "inactive")}
            />
            <Label htmlFor="active" className="cursor-pointer font-normal">
              Active
            </Label>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={updatePromptMutation.isPending}
            >
              {updatePromptMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Prompt"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}


