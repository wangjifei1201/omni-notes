'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Circle, Clock, AlertCircle, FileText, Download, Mic, Brain, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/stores';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AnalysisStep {
  id: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
}

const ANALYSIS_STEPS: AnalysisStep[] = [
  {
    id: 'extract',
    icon: <FileText className="h-4 w-4 sm:h-5 sm:w-5" />,
    title: '分析',
    desc: '提取视频信息和字幕',
  },
  {
    id: 'download',
    icon: <Download className="h-4 w-4 sm:h-5 sm:w-5" />,
    title: '下载',
    desc: '下载视频音频文件',
  },
  {
    id: 'transcribe',
    icon: <Mic className="h-4 w-4 sm:h-5 sm:w-5" />,
    title: '语音转义',
    desc: 'Whisper 语音转文字',
  },
  {
    id: 'analyze',
    icon: <Brain className="h-4 w-4 sm:h-5 sm:w-5" />,
    title: '大模型分析',
    desc: '纠错并生成摘要和观点',
  },
];

interface StepStatus {
  status: 'pending' | 'running' | 'completed' | 'error';
  startTime?: number;
  endTime?: number;
  duration?: number;
}

interface DownloadProgress {
  percent: number;
  size?: string;
  speed?: string;
  text?: string;
}

interface TranscribeLive {
  percent: number;
  time?: string;
  text?: string;
}

// Backend step info from SSE progress snapshot
interface BackendStepInfo {
  status: string;
  start_time: number | null;
  end_time: number | null;
}

// Full progress snapshot from SSE (embedded in data with event: "progress")
interface FullProgressSnapshot {
  event: string;
  status: string;
  current_step: string;
  steps: Record<string, BackendStepInfo>;
  download_progress?: DownloadProgress;
  transcribe_live?: TranscribeLive;
  error?: string;
}

export default function AnalyzePage() {
  const router = useRouter();
  const { currentVideo, currentTask } = useAnalysisStore();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(currentTask?.taskId ? String(currentTask.taskId) : null);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [elapsedTime, setElapsedTime] = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState('准备开始...');
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [transcribeLive, setTranscribeLive] = useState<TranscribeLive | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Use refs to track current state for event handlers (avoid stale closure issues)
  const isAnalyzingRef = useRef(isAnalyzing);
  const errorRef = useRef(error);

  useEffect(() => {
    isAnalyzingRef.current = isAnalyzing;
  }, [isAnalyzing]);

  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  // Redirect if no video
  useEffect(() => {
    if (!currentVideo) {
      router.push('/');
    }
  }, [currentVideo, router]);

  // Auto-start analysis when page loads
  useEffect(() => {
    if (currentVideo && !isAnalyzing && !taskId) {
      startAnalysis();
    }
  }, [currentVideo]);

  // If taskId exists from previous navigation, start analyzing immediately
  useEffect(() => {
    if (taskId && taskId !== 'undefined' && currentVideo) {
      setIsAnalyzing(true);
      // Initialize step statuses
      const initialStatuses: Record<string, StepStatus> = {};
      ANALYSIS_STEPS.forEach((step) => {
        initialStatuses[step.id] = { status: 'pending' };
      });
      setStepStatuses(initialStatuses);
      // Connect to SSE
      connectToSSE(taskId);
    }
  }, [taskId, currentVideo]);

  // Timer
  useEffect(() => {
    if (!isAnalyzing) return;

    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);

      // Update step durations for running steps
      setStepStatuses((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((stepId) => {
          const step = updated[stepId];
          if (step.status === 'running' && step.startTime) {
            step.duration = Math.floor((Date.now() - step.startTime) / 1000);
          }
        });
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const connectToSSE = (tid: string) => {
    if (!tid || tid === 'undefined') {
      console.error('Invalid task ID:', tid);
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Connect directly to backend for SSE to avoid Next.js proxy buffering.
    // CORS is configured on the backend to allow http://localhost:3000 with credentials.
    const sseBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const eventSource = new EventSource(
      `${sseBaseUrl}/api/v1/analysis/${tid}/progress`,
      { withCredentials: true }
    );

    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('SSE connection opened');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleSSEEvent(data);
      } catch (err) {
        console.error('Failed to parse SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      eventSource.close();

      if (isAnalyzingRef.current && !errorRef.current) {
        console.log('SSE failed, falling back to polling');
        startPolling(tid);
      }
    };
  };

  const handleSSEEvent = (data: Record<string, unknown>) => {
    const eventType = data.event as string;

    switch (eventType) {
      case 'progress':
        updateFromFullProgress(data as unknown as FullProgressSnapshot);
        break;
      case 'queue':
        setCurrentMessage((data.message as string) || '等待队列中...');
        break;
      case 'completed':
        handleCompleted();
        break;
      case 'error':
        handleError((data.message as string) || '分析过程中出现错误');
        break;
      case 'ping':
        break;
      default:
        console.log('Unknown event:', data);
    }
  };

  const startPolling = (tid: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/v1/analysis/${tid}/status`, {
          credentials: 'include',
        });
        if (!response.ok) throw new Error('Failed to fetch status');

        const data = await response.json();

        // The polling endpoint returns { progress: { status, current_step, steps, ... } }
        if (data.progress && data.progress.steps) {
          updateFromFullProgress({
            event: 'progress',
            ...data.progress,
          });
        }

        if (data.status === 'completed') {
          clearInterval(pollInterval);
          handleCompleted();
        } else if (data.status === 'failed') {
          clearInterval(pollInterval);
          handleError(data.progress?.error || '分析失败');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 2000);

    setTimeout(() => clearInterval(pollInterval), 600000);
  };

  const updateFromFullProgress = (snapshot: FullProgressSnapshot) => {
    const {
      current_step,
      steps,
      download_progress: dlProg,
      transcribe_live: txLive,
      error: progressError,
    } = snapshot;

    // Update step statuses from full snapshot
    if (steps) {
      setStepStatuses((prev) => {
        const updated = { ...prev };

        for (const [stepId, info] of Object.entries(steps)) {
          const prevStep = prev[stepId] || { status: 'pending' };
          const newStatus = info.status === 'skipped' ? 'completed' : info.status;

          if (newStatus === 'running' && prevStep.status !== 'running') {
            updated[stepId] = { status: 'running', startTime: Date.now() };
          } else if (newStatus === 'completed' && prevStep.status !== 'completed') {
            updated[stepId] = {
              status: 'completed',
              startTime: prevStep.startTime,
              endTime: Date.now(),
              duration: prevStep.startTime
                ? Math.floor((Date.now() - prevStep.startTime) / 1000)
                : 0,
            };
          } else if (newStatus === 'error') {
            updated[stepId] = { status: 'error', startTime: prevStep.startTime };
          }
          // else: keep existing state (still pending or already in target state)
        }

        return updated;
      });
    }

    // Update download sub-progress
    if (dlProg) {
      setDownloadProgress(dlProg);
    }

    // Update transcribe sub-progress
    if (txLive) {
      setTranscribeLive(txLive);
    }

    // Calculate and set overall progress
    if (steps) {
      const stepWeights: Record<string, [number, number]> = {
        extract: [0, 10],
        download: [10, 30],
        transcribe: [30, 70],
        analyze: [70, 100],
      };

      let progress = 0;

      for (const [stepId, [base, end]] of Object.entries(stepWeights)) {
        const info = steps[stepId];
        if (!info) continue;

        if (info.status === 'completed' || info.status === 'skipped') {
          progress = Math.max(progress, end);
        } else if (info.status === 'running') {
          let subPct = 0;
          if (stepId === 'download' && dlProg) {
            subPct = dlProg.percent / 100;
          } else if (stepId === 'transcribe' && txLive) {
            subPct = txLive.percent / 100;
          } else {
            subPct = 0.1;
          }
          progress = Math.max(progress, base + (end - base) * subPct);
        }
      }

      setOverallProgress(Math.round(progress));
    }

    // Update current message
    const stepMessages: Record<string, string> = {
      extract: '正在提取视频信息...',
      download: dlProg?.text ? `下载中: ${dlProg.text}` : '正在下载音频...',
      transcribe: txLive?.text ? `识别中: ${txLive.text}` : '语音识别中...',
      analyze: 'AI 分析中...',
    };
    if (current_step && stepMessages[current_step]) {
      setCurrentMessage(stepMessages[current_step]);
    }

    // Handle error from progress
    if (progressError) {
      handleError(progressError);
    }
  };

  const handleCompleted = () => {
    setOverallProgress(100);
    setCurrentMessage('分析完成！');

    // Mark all steps as completed
    setStepStatuses((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((stepId) => {
        if (updated[stepId].status !== 'error') {
          updated[stepId] = {
            ...updated[stepId],
            status: 'completed',
            endTime: Date.now(),
          };
        }
      });
      return updated;
    });

    // Navigate to result page
    setTimeout(() => {
      if (taskId) {
        router.push(`/analysis/${taskId}`);
      }
    }, 1500);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setIsAnalyzing(false);
    setCurrentMessage('分析失败');
    toast.error('分析失败', { description: errorMessage });

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
  };

  const startAnalysis = async () => {
    if (!currentVideo) return;

    setIsAnalyzing(true);
    setError(null);
    setDownloadProgress(null);
    setTranscribeLive(null);

    // Initialize step statuses
    const initialStatuses: Record<string, StepStatus> = {};
    ANALYSIS_STEPS.forEach((step) => {
      initialStatuses[step.id] = { status: 'pending' };
    });
    setStepStatuses(initialStatuses);

    try {
      const videoUrl =
        currentVideo.original_url ||
        (currentVideo.platform === 'bilibili'
          ? `https://www.bilibili.com/video/${currentVideo.video_id}`
          : `https://www.douyin.com/video/${currentVideo.video_id}`);

      const newTaskId = await analysisApi.create({
        url: videoUrl,
        analysis_type: 'comprehensive',
      });

      setTaskId(newTaskId);

      // Mark first step as running
      setStepStatuses((prev) => ({
        ...prev,
        extract: { status: 'running', startTime: Date.now() },
      }));

      // Connect to SSE for real-time updates
      connectToSSE(newTaskId);
    } catch (err: unknown) {
      const errorMessage = (err as { response?: { data?: { detail?: { message?: string } } }; message?: string })?.response?.data?.detail?.message ||
                          (err as { message?: string })?.message ||
                          '创建分析任务失败，请检查网络连接后重试';

      let friendlyMessage = errorMessage;
      if (errorMessage.includes('QUEUE_FULL')) {
        friendlyMessage = '当前分析任务过多，请稍后再试';
      } else if (errorMessage.includes('解析视频信息失败')) {
        friendlyMessage = '无法解析该视频，请检查链接是否正确';
      } else if (errorMessage.includes('不支持的链接')) {
        friendlyMessage = '仅支持 Bilibili 和抖音视频链接';
      }

      setError(friendlyMessage);
      toast.error('创建分析任务失败', { description: friendlyMessage });
      setIsAnalyzing(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStepIcon = (stepId: string, status: StepStatus['status']) => {
    if (status === 'completed') {
      return <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500" />;
    }
    if (status === 'running') {
      return <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-500 animate-pulse" />;
    }
    if (status === 'error') {
      return <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-500" />;
    }
    return <Circle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />;
  };

  const getFriendlyErrorSuggestion = () => {
    if (!error) return null;

    if (error.includes('字幕') || error.includes(' Whisper')) {
      return '该视频可能没有字幕，请尝试使用其他视频';
    }
    if (error.includes('下载')) {
      return '视频下载失败，请检查链接是否有效';
    }
    if (error.includes('AI') || error.includes('分析')) {
      return 'AI 分析服务暂时不可用，请稍后重试';
    }
    return '请检查网络连接或稍后重试';
  };

  if (!currentVideo) {
    return null;
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Back Button */}
      <div className="mb-4 sm:mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push('/')}
          className="gap-2 text-muted-foreground hover:text-foreground text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          返回首页
        </Button>
      </div>

      {/* Progress Display */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-xl mx-auto w-full px-2">
        {/* Spinner */}
        {!error && (
          <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4 sm:mb-6" />
        )}

        {/* Error State */}
        {error ? (
          <div className="text-center px-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-3 sm:mb-4 mx-auto">
              <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-red-500" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold mb-2 text-red-500">分析失败</h2>
            <p className="text-sm sm:text-base text-muted-foreground mb-2">{error}</p>
            {getFriendlyErrorSuggestion() && (
              <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                {getFriendlyErrorSuggestion()}
              </p>
            )}
            <Button
              onClick={() => {
                setError(null);
                startAnalysis();
              }}
              className="mt-4"
            >
              重试
            </Button>
          </div>
        ) : (
          <>
            {/* Status */}
            <h2 className="text-lg sm:text-xl font-bold mb-2 text-center">AI 正在分析视频...</h2>
            <div className="text-2xl sm:text-3xl font-bold text-indigo-500 mb-2 font-mono">
              {formatDuration(elapsedTime)}
            </div>
            <p className="text-sm sm:text-base text-muted-foreground mb-1 sm:mb-2 text-center">
              {ANALYSIS_STEPS.find((s) => stepStatuses[s.id]?.status === 'running')?.title ||
                '准备开始...'}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 text-center px-4">{currentMessage}</p>

            {/* Progress Bar */}
            <div className="w-full max-w-xs h-1 bg-muted rounded-full mb-6 sm:mb-8">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 rounded-full transition-all duration-300"
                style={{ width: `${overallProgress}%` }}
              />
            </div>

            {/* Steps */}
            <div className="w-full space-y-2">
              {ANALYSIS_STEPS.map((step) => {
                const status = stepStatuses[step.id]?.status || 'pending';
                const duration = stepStatuses[step.id]?.duration;

                return (
                  <div
                    key={step.id}
                    className={cn(
                      'flex flex-col p-3 sm:p-4 rounded-lg sm:rounded-xl border transition-all',
                      status === 'running' && 'border-indigo-500 bg-indigo-500/10',
                      status === 'completed' && 'border-emerald-500/50 bg-emerald-500/5',
                      status === 'error' && 'border-red-500/50 bg-red-500/5',
                      status === 'pending' && 'border-border bg-card/50 opacity-60'
                    )}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div
                        className={cn(
                          'w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                          status === 'running' && 'bg-indigo-500/20 text-indigo-500',
                          status === 'completed' && 'bg-emerald-500/20 text-emerald-500',
                          status === 'error' && 'bg-red-500/20 text-red-500',
                          status === 'pending' && 'bg-muted text-muted-foreground'
                        )}
                      >
                        {getStepIcon(step.id, status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-xs sm:text-sm">{step.title}</div>
                        <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{step.desc}</div>
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground font-mono flex-shrink-0">
                        {status === 'running' ? (
                          <Clock className="h-3 w-3 sm:h-4 sm:w-4 animate-pulse" />
                        ) : (
                          formatDuration(duration)
                        )}
                      </div>
                    </div>

                    {/* Download sub-progress */}
                    {step.id === 'download' && status === 'running' && downloadProgress && (
                      <div className="mt-2 sm:mt-3 ml-10 sm:ml-12">
                        <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground mb-1">
                          <span>{downloadProgress.percent.toFixed(1)}%</span>
                          <span className="truncate ml-2">
                            {downloadProgress.size && downloadProgress.speed
                              ? `${downloadProgress.size} @ ${downloadProgress.speed}`
                              : ''}
                          </span>
                        </div>
                        <div className="w-full h-1 sm:h-1.5 bg-muted rounded-full">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(downloadProgress.percent, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Transcribe sub-progress */}
                    {step.id === 'transcribe' && status === 'running' && transcribeLive && (
                      <div className="mt-2 sm:mt-3 ml-10 sm:ml-12">
                        <div className="flex items-center justify-between text-[10px] sm:text-xs text-muted-foreground mb-1">
                          <span>{transcribeLive.percent}%</span>
                          {transcribeLive.time && <span>{transcribeLive.time}</span>}
                        </div>
                        <div className="w-full h-1 sm:h-1.5 bg-muted rounded-full">
                          <div
                            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(transcribeLive.percent, 100)}%` }}
                          />
                        </div>
                        {transcribeLive.text && (
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-1.5 truncate italic">
                            &ldquo;{transcribeLive.text}&rdquo;
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
