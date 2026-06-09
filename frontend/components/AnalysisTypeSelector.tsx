'use client';

import { useState } from 'react';
import {
  Sparkles,
  FileText,
  List,
  GitBranch,
  MessageSquare,
  BrainCircuit,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAnalysisStore } from '@/stores';
import { cn } from '@/lib/utils';
import type { AnalysisType } from '@/types';

interface AnalysisTypeOption {
  value: AnalysisType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

const analysisTypes: AnalysisTypeOption[] = [
  {
    value: 'comprehensive',
    label: '综合分析',
    description: '生成完整报告，包括摘要、要点和章节分析',
    icon: <Sparkles className="h-5 w-5" />,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
  {
    value: 'summary',
    label: '内容摘要',
    description: '生成简洁的视频内容摘要',
    icon: <FileText className="h-5 w-5" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  {
    value: 'key_points',
    label: '关键要点',
    description: '提取视频的关键要点和核心观点',
    icon: <List className="h-5 w-5" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  {
    value: 'chapters',
    label: '章节分析',
    description: '按时间线分析视频结构和章节内容',
    icon: <BrainCircuit className="h-5 w-5" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  {
    value: 'mindmap',
    label: '思维导图',
    description: '生成视频内容的思维导图结构',
    icon: <GitBranch className="h-5 w-5" />,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
  },
  {
    value: 'custom',
    label: '自定义分析',
    description: '使用自定义提示词进行个性化分析',
    icon: <MessageSquare className="h-5 w-5" />,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
  },
];

interface AnalysisTypeSelectorProps {
  onSubmit?: (type: AnalysisType, customPrompt?: string) => void;
  disabled?: boolean;
}

export function AnalysisTypeSelector({
  onSubmit,
  disabled = false,
}: AnalysisTypeSelectorProps) {
  const { selectedAnalysisType, customPrompt, setSelectedType, setCustomPrompt } =
    useAnalysisStore();
  const [hoveredType, setHoveredType] = useState<AnalysisType | null>(null);

  const displayType = hoveredType || selectedAnalysisType;
  const displayTypeInfo = analysisTypes.find((t) => t.value === displayType);

  const handleTypeSelect = (type: AnalysisType) => {
    setSelectedType(type);
  };

  const handleSubmit = () => {
    if (selectedAnalysisType === 'custom' && !customPrompt.trim()) {
      return;
    }
    onSubmit?.(
      selectedAnalysisType,
      selectedAnalysisType === 'custom' ? customPrompt : undefined
    );
  };

  return (
    <Card className="w-full border-2 border-primary/10 shadow-lg">
      <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 to-transparent">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          选择分析类型
          <Badge variant="secondary" className="ml-2">
            {analysisTypes.length} 种分析模式
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Analysis Type Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {analysisTypes.map((type) => {
            const isSelected = selectedAnalysisType === type.value;

            return (
              <button
                key={type.value}
                type="button"
                onClick={() => handleTypeSelect(type.value)}
                onMouseEnter={() => setHoveredType(type.value)}
                onMouseLeave={() => setHoveredType(null)}
                disabled={disabled}
                className={cn(
                  'relative flex flex-col items-start p-4 rounded-xl border-2 transition-all duration-200 text-left',
                  'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]',
                  isSelected
                    ? `${type.bgColor} ${type.borderColor} border-2`
                    : 'bg-card border-border hover:border-primary/30',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className={cn('h-5 w-5', type.color)} />
                  </div>
                )}

                {/* Icon */}
                <div
                  className={cn(
                    'p-2 rounded-lg mb-2 transition-colors',
                    isSelected ? 'bg-white/80' : 'bg-muted'
                  )}
                >
                  <span className={type.color}>{type.icon}</span>
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'font-semibold text-sm mb-1',
                    isSelected ? type.color : 'text-foreground'
                  )}
                >
                  {type.label}
                </span>

                {/* Description */}
                <span className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                  {type.description}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Type Details */}
        {displayTypeInfo && (
          <div
            className={cn(
              'rounded-xl p-4 border-2 transition-all duration-300',
              displayTypeInfo.bgColor,
              displayTypeInfo.borderColor
            )}
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/80 rounded-lg">
                <span className={displayTypeInfo.color}>{displayTypeInfo.icon}</span>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground">
                  {displayTypeInfo.label}
                </h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {displayTypeInfo.description}
                </p>
              </div>
            </div>
          </div>
        )}

        <Separator />

        {/* Custom prompt input */}
        {selectedAnalysisType === 'custom' && (
          <div className="space-y-3 bg-muted/50 rounded-xl p-4 border border-border">
            <Label className="flex items-center gap-2 text-foreground">
              <MessageSquare className="h-4 w-4 text-cyan-600" />
              自定义提示词
            </Label>
            <Textarea
              placeholder="请输入您的分析要求，例如：分析这个视频中有趣的时刻..."
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={disabled}
              rows={4}
              className="bg-white resize-none"
            />
            <p className="text-xs text-muted-foreground">
              AI将根据您的提示词对视频内容进行分析
            </p>
          </div>
        )}

        {/* Submit button */}
        <Button
          onClick={handleSubmit}
          disabled={disabled || (selectedAnalysisType === 'custom' && !customPrompt.trim())}
          className="w-full h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all"
          size="lg"
        >
          <Sparkles className="mr-2 h-5 w-5" />
          开始分析
        </Button>
      </CardContent>
    </Card>
  );
}
