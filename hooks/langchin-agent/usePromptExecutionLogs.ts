import { useQuery } from '@tanstack/react-query'

export function usePromptExecutionLogs({ 
  promptId, 
  status, 
  timeFilter 
}: { 
  promptId?: string; 
  status?: string;
  timeFilter?: 'all' | 'today' | 'week' | 'month' | 'year';
}) {
  return useQuery({
    queryKey: ['promptExecutionLogs', promptId, status, timeFilter],
    queryFn: async () => {
      let url = '/api/woo-langchin-agent/execution-logs?';
      if (promptId) url += `promptId=${encodeURIComponent(promptId)}&`;
      if (status) url += `status=${encodeURIComponent(status)}&`;
      if (timeFilter) url += `timeFilter=${encodeURIComponent(timeFilter)}&`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Unable to fetch logs');
      return response.json();
    },
    staleTime: 60000,
  });
}

