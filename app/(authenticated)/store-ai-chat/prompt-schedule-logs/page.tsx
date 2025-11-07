"use client";
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { usePromptExecutionLogs } from '@/hooks/langchin-agent/usePromptExecutionLogs';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { XIcon, MessageSquareIcon } from 'lucide-react';
import { Database } from '@/types/database';

type PromptExecutionLog = Database["public"]["Tables"]["prompt_execution_logs"]["Row"] & {
  prompt_title?: string | null;
  prompt_description?: string | null;
  thread_id?: number | null;
};

const statusLabels = {
  completed: 'Success',
  running: 'Running',
  failed: 'Fail',
};

function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).replace(',', '').replace(/(\d+)\/(\d+)\/(\d+),/, '$3-$1-$2');
  } catch {
    return dateString;
  }
}

export default function PromptScheduleLogsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPromptId = searchParams.get('promptId') || '';
  
  const [searchQuery, setSearchQuery] = useState('');
  const [promptId, setPromptId] = useState(initialPromptId);
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'running' | 'failed'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all');

  const {
    data: logs,
    isLoading,
    isError,
    // refetch,
  } = usePromptExecutionLogs({
    promptId: promptId || undefined,
    status: statusFilter === 'all' ? undefined : statusFilter,
    timeFilter,
  });

  // Filter logs by search query (client-side)
  const filteredLogs = (logs || []).filter((log: PromptExecutionLog) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const title = (log.prompt_title || '').toLowerCase();
    const description = (log.prompt_description || '').toLowerCase();
    const dateTime = formatDateTime(log.started_at || log.created_at).toLowerCase();
    return title.includes(query) || description.includes(query) || dateTime.includes(query);
  });

  const handleViewInChat = (log: PromptExecutionLog) => {
    if (log.thread_id) {
      router.push(`/store-ai-chat/agentchat/${log.thread_id}`);
    }
  };

  // Determine progress status (Due/Not Due)
  // If failed, show "Due", otherwise "Not Due"
  const getProgressStatus = (log: PromptExecutionLog): 'due' | 'not-due' => {
    return log.status === 'failed' ? 'due' : 'not-due';
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl">
        {/* Close Button */}
        <div className="mb-6 flex justify-end">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => router.back()}
          >
            <XIcon className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Search Bar */}
        <div className="mb-4">
          <Input
            type="search"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>

        {/* Filters */}
        <div className="mb-8 flex flex-wrap gap-4">
          <Select 
            value={timeFilter} 
            onValueChange={(value: 'all' | 'today' | 'week' | 'month' | 'year') => setTimeFilter(value)}
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Select time period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={statusFilter} 
            onValueChange={(value: 'all' | 'completed' | 'running' | 'failed') => setStatusFilter(value)}
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Success</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="failed">Fail</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="Filter by Prompt ID..."
            value={promptId}
            onChange={(e) => setPromptId(e.target.value)}
            className="w-full md:w-[180px]"
          />
        </div>

        {/* Loading and Error States */}
        {isLoading && (
          <div className="py-12 text-center text-muted-foreground">Loading logs...</div>
        )}
        {isError && (
          <div className="py-12 text-center text-destructive">Error loading logs.</div>
        )}

        {/* Logs Grid */}
        {!isLoading && !isError && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredLogs.map((log: PromptExecutionLog) => {
              const progressStatus = getProgressStatus(log);
              const dateTime = formatDateTime(log.started_at || log.created_at);
              const status = log.status === 'completed' ? 'success' : log.status === 'failed' ? 'fail' : 'running';

              return (
                <Card key={log.id} className="flex flex-col">
                  <CardContent className="flex-1 space-y-4 pt-6">
                    <div className="space-y-3">
                      {/* Prompt Title */}
                      <div>
                        <label className="font-semibold text-sm text-muted-foreground">Prompt</label>
                        <p className="mt-1 text-sm">{log.prompt_title || `Prompt #${log.prompt_id}`}</p>
                      </div>

                      {/* Prompt Text */}
                      <div>
                        <label className="font-semibold text-sm text-muted-foreground">Prompt Text</label>
                        <p className="mt-1 text-sm leading-relaxed">
                          {log.prompt_description || 'No description available'}
                        </p>
                      </div>

                      {/* Progress Status */}
                      <div>
                        <label className="font-semibold text-sm text-muted-foreground">Progress Status</label>
                        <div className="mt-1">
                          <Badge 
                            variant={progressStatus === 'due' ? 'destructive' : 'secondary'}
                            className={progressStatus === 'due' ? 'bg-red-600 text-white' : ''}
                          >
                            {progressStatus === 'due' ? 'Due' : 'Not Due'}
                          </Badge>
                        </div>
                      </div>

                      {/* Status */}
                      <div>
                        <p className="text-sm">
                          <span className="font-semibold text-muted-foreground">Status: </span>
                          <span className={
                            status === 'success' 
                              ? 'text-green-600' 
                              : status === 'fail' 
                              ? 'text-red-600' 
                              : 'text-blue-600'
                          }>
                            {statusLabels[log.status as keyof typeof statusLabels] || log.status}
                          </span>
                        </p>
                      </div>

                      {/* Date and Time */}
                      <div>
                        <label className="font-semibold text-sm text-muted-foreground">Date and Time</label>
                        <p className="mt-1 text-sm">{dateTime}</p>
                      </div>

                      {/* Errors Section for Failed Logs */}
                      {log.status === 'failed' && log.error_message && (
                        <div>
                          <label className="font-semibold text-sm text-muted-foreground">Errors:</label>
                          <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-2 text-xs text-red-600 border border-red-200">
                            {log.error_message}
                          </pre>
                        </div>
                      )}
                    </div>

                    {/* Message Button */}
                    {log.thread_id && log.thread_id !== null && <div className="flex items-center justify-end border-t pt-4">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8" 
                        onClick={() => handleViewInChat(log)}
                      >
                        <MessageSquareIcon className="h-4 w-4" />
                        <span className="sr-only">View in chat</span>
                      </Button>
                    </div>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !isError && filteredLogs.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No logs found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}
