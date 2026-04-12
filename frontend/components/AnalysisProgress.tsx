'use client';

import { Loader2, CheckCircle2, XCircle, AlertCircle, Sparkles } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAnalysisStore } from '@/stores';
import { cn } from '@/lib/utils';
import type { AnalysisStatus } from '@/types';

interface AnalysisProgressCardProps {
  onCancel?: () => void;
}

function getStatusIcon(status: AnalysisStatus) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="h-6 w-6 text-emerald-500" />;
    case 'failed':
      return <XCircle className="h-6 w-6 text-red-500" />;
    case 'cancelled':
      return <AlertCircle className="h-6 w-6 text-muted-foreground" />;
    default:
      return <Loader2 className="h-6 w-6 animate-spin text-primary" />;
  }
}

function getStatusLabel(status: AnalysisStatus) {
  switch (status) {
    case 'pending':
      return { label: '等待中', variant: 'secondary' as const, color: 'bg-amber-100 text-amber-700 border-amber-200' };
    case 'processing':
      return { label: '分析中', variant: 'default' as const, color: 'bg-primary/10 text-primary border-primary/20' };
    case 'completed':
      return { label: '已完成', variant: 'default' as const, color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
    case 'failed':
      return { label: '失败', variant: 'destructive' as const, color: 'bg-red-100 text-red-700 border-red-200' };
    case 'cancelled':
      return { label: '已取消', variant: 'secondary' as const, color: 'bg-muted text-muted-foreground' };
    default:
      return { label: status, variant: 'secondary' as const, color: 'bg-muted' };
  }
}

function getAnalysisTypeLabel(type: string) {
  const types: Record<string, { label: string; color: string }> = {
    comprehensive: { label: '综合分析', color: 'text-amber-600 bg-amber-50 border-amber-200' },
    summary: { label: '内容摘要', color: 'text-blue-600 bg-blue-50 border-blue-200' },
    key_points: { label: '关键要点', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    chapters: { label: '章节分析', color: 'text-purple-600 bg-purple-50 border-purple-200' },
    mindmap: { label: '思维导图', color: 'text-rose-600 bg-rose-50 border-rose-200' },
    custom: { label: '自定义分析', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
  };
  return types[type] || { label: type, color: 'text-muted-foreground bg-muted' };
}

export function AnalysisProgressCard({ onCancel }: AnalysisProgressCardProps) {
  const { currentTask, currentVideo } = useAnalysisStore();

  if (!currentTask) return null;

  const statusInfo = getStatusLabel(currentTask.status);
  const typeInfo = getAnalysisTypeLabel(currentTask.type);
  const isActive = currentTask.status === 'pending' || currentTask.status === 'processing';

  return (
    <Card className="w-full border-2 shadow-lg overflow-hidden">
      <CardHeader className={cn(
        'pb-4',
        currentTask.status === 'completed' && 'bg-emerald-50/50',
        currentTask.status === 'failed' && 'bg-red-50/50',
        currentTask.status === 'processing' && 'bg-primary/5',
        currentTask.status === 'pending' && 'bg-amber-50/50'
      )}>
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="p-2 bg-white rounded-xl shadow-sm">
            {getStatusIcon(currentTask.status)}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span>AI 分析任务</span>
              <Badge variant="outline" className={cn('font-normal', typeInfo.color)}>
                {typeInfo.label}
              </Badge>
            </div>
            {currentVideo && (
              <p className="text-sm text-muted-foreground truncate max-w-[400px] font-normal">
                {currentVideo.title}
              </p>
            )}
          </div>
          <Badge variant="outline" className={cn('shrink-0', statusInfo.color)}>
            {statusInfo.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-5">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {currentTask.message}
            </span>
            <span className="font-semibold text-primary">{currentTask.progress}%</span>
          </div>
          <div className="relative">
            <Progress
              value={currentTask.progress}
              className="h-3"
            />
            {isActive && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-primary/10 to-transparent rounded-full" />
            )}
          </div>
        </div>

        {/* Error message */}
        {currentTask.error && (
          <div className="text-sm text-red-600 bg-red-50 p-4 rounded-xl border border-red-200 flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{currentTask.error}</span>
          </div>
        )}

        {/* Cancel button */}
        {isActive && onCancel && (
          <Button
            variant="outline"
            size="lg"
            onClick={onCancel}
            className="w-full h-11 text-base border-2 hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30 transition-all"
          >
            <XCircle className="mr-2 h-5 w-5" />
            取消分析
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
