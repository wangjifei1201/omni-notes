import { useEffect, useRef, useCallback } from 'react';
import { useAnalysisStore } from '@/stores/analysis';
import type { AnalysisProgress, AnalysisResult } from '@/types';

// Use relative URL to go through Next.js proxy (same-origin)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

export function useAnalysisProgress(taskId: string | null) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const { updateTask, setCurrentResult } = useAnalysisStore();

  const stopProgressTracking = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!taskId) {
      stopProgressTracking();
      return;
    }

    // Close existing connection
    stopProgressTracking();

    // Create new EventSource connection
    const eventSource = new EventSource(
      `${API_BASE_URL}/api/v1/analysis/${taskId}/progress`
    );
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data: AnalysisProgress = JSON.parse(event.data);

        // Update task in store
        updateTask(taskId, {
          status: data.status,
          progress: data.progress,
          message: data.message,
          result: data.result,
        });

        // If completed or failed, close connection
        if (data.status === 'completed') {
          if (data.result) {
            setCurrentResult(data.result);
          }
          stopProgressTracking();
        } else if (data.status === 'failed') {
          stopProgressTracking();
        }
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE error:', error);
      // Try to reconnect after a delay if not explicitly closed
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          // Connection closed, might need to check status via regular API
        }
      }, 5000);
    };

    return () => {
      stopProgressTracking();
    };
  }, [taskId, updateTask, setCurrentResult, stopProgressTracking]);

  return { stopProgressTracking };
}

// Hook to check if analysis is in progress
export function useIsAnalyzing() {
  const { isAnalyzing, isParsing } = useAnalysisStore();
  return isAnalyzing || isParsing;
}

// Hook to get analysis progress percentage
export function useAnalysisProgressValue() {
  const { currentTask } = useAnalysisStore();
  return currentTask?.progress ?? 0;
}

// Hook to get current task status
export function useCurrentTask() {
  const { currentTask } = useAnalysisStore();
  return currentTask;
}

// Hook to get current result
export function useCurrentResult(): AnalysisResult | null {
  const { currentResult } = useAnalysisStore();
  return currentResult;
}
