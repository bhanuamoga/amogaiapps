import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Prompt, PromptCreateRequest, PromptUpdateRequest, UserSearchResult } from "@/types/prompts";

// Fetch all prompts for the current user
export function usePrompts() {
  return useQuery<Prompt[]>({
    queryKey: ["prompts"],
    queryFn: async () => {
      const response = await fetch("/api/woo-langchin-agent/prompts");
      if (!response.ok) {
        throw new Error("Failed to fetch prompts");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Fetch a single prompt by ID
export function usePrompt(promptId: number) {
  return useQuery<Prompt>({
    queryKey: ["prompts", promptId],
    queryFn: async () => {
      const response = await fetch(`/api/woo-langchin-agent/prompts/${promptId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch prompt");
      }
      return response.json();
    },
    enabled: !!promptId,
  });
}

// Create a new prompt
export function useCreatePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PromptCreateRequest) => {
      const response = await fetch("/api/woo-langchin-agent/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create prompt");
      }

      return response.json();
    },
    onSuccess: (data) => {
      // Only invalidate the list query, don't update individual prompts
      // This ensures we fetch fresh data from the server instead of relying on cache
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      console.log("Prompt created successfully, cache invalidated");
    },
    onError: (error) => {
      console.error("Error creating prompt:", error);
    },
  });
}

// Update an existing prompt
export function useUpdatePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PromptUpdateRequest) => {
      const response = await fetch(`/api/woo-langchin-agent/prompts/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update prompt");
      }

      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      queryClient.invalidateQueries({ queryKey: ["prompts", data.id] });
    },
  });
}

// Delete a prompt (soft delete)
export function useDeletePrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (promptId: number) => {
      const response = await fetch(`/api/woo-langchin-agent/prompts/${promptId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete prompt");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
    },
  });
}

// Search for users
export function useUserSearch(query: string, excludeIds: number[] = []) {
  return useQuery<UserSearchResult[]>({
    queryKey: ["userSearch", query, excludeIds],
    queryFn: async () => {
      if (!query || query.length < 2) {
        return [];
      }

      const excludeParam = excludeIds.length > 0 ? `&exclude=${excludeIds.join(',')}` : '';
      const response = await fetch(`/api/woo-langchin-agent/users/search?query=${encodeURIComponent(query)}${excludeParam}`);
      
      if (!response.ok) {
        throw new Error("Failed to search users");
      }
      
      return response.json();
    },
    enabled: !!query && query.length >= 2,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Execute a specific prompt (for testing purposes)
export function useExecutePrompt() {
  return useMutation({
    mutationFn: async (promptId: number) => {
      const response = await fetch("/api/woo-langchin-agent/prompts/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to execute prompt");
      }

      return response.json();
    },
  });
}


