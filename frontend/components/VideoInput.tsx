'use client';

import { useState } from 'react';
import { Link2, Loader2, AlertCircle, CheckCircle2, Play, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { videoApi } from '@/lib/api';
import { useAnalysisStore } from '@/stores';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Video } from '@/types';

interface VideoInputProps {
  onVideoParsed?: (video: Video) => void;
}

export function VideoInput({ onVideoParsed }: VideoInputProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { setCurrentVideo, setParsing } = useAnalysisStore();

  // Extract URL from mobile share text like 【标题-哔哩哔哩】 https://b23.tv/xxx
  const extractUrl = (text: string): string => {
    const trimmed = text.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed.split(/\s/)[0];
    }
    const match = trimmed.match(/https?:\/\/[^\s\u3000<>"'\]）)]+/);
    return match ? match[0] : trimmed;
  };

  const detectPlatform = (text: string): 'bilibili' | 'douyin' | null => {
    if (text.includes('bilibili.com') || text.includes('b23.tv')) {
      return 'bilibili';
    }
    if (text.includes('douyin.com') || text.includes('iesdouyin.com') || text.includes('v.douyin.com')) {
      return 'douyin';
    }
    return null;
  };

  const platform = detectPlatform(url);

  const getPlatformColor = (platform: string | null) => {
    switch (platform) {
      case 'bilibili':
        return {
          bg: 'bg-pink-50',
          border: 'border-pink-200',
          text: 'text-pink-600',
          badge: 'bg-pink-100 text-pink-700 border-pink-200',
        };
      case 'douyin':
        return {
          bg: 'bg-cyan-50',
          border: 'border-cyan-200',
          text: 'text-cyan-600',
          badge: 'bg-cyan-100 text-cyan-700 border-cyan-200',
        };
      default:
        return {
          bg: 'bg-muted/50',
          border: 'border-border',
          text: 'text-muted-foreground',
          badge: 'bg-muted text-muted-foreground',
        };
    }
  };

  const platformStyle = getPlatformColor(platform);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputUrl = extractUrl(url);
    if (!inputUrl) {
      setError('请输入视频链接');
      return;
    }

    if (!platform) {
      setError('请输入有效的Bilibili或抖音视频链接');
      return;
    }

    setError('');
    setIsLoading(true);
    setParsing(true);

    try {
      const video = await videoApi.parse({ url: inputUrl });
      setCurrentVideo(video);
      toast.success('视频解析成功', {
        description: video.title,
      });
      onVideoParsed?.(video);
    } catch (err) {
      const message = err instanceof Error ? err.message : '视频解析失败';
      setError(message);
      toast.error('视频解析失败', {
        description: message,
      });
    } finally {
      setIsLoading(false);
      setParsing(false);
    }
  };

  const clearUrl = () => {
    setUrl('');
    setError('');
  };

  return (
    <Card className="w-full border-2 shadow-lg overflow-hidden">
      <CardHeader className="pb-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          视频链接
          <Badge variant="outline" className="ml-2 font-normal">
            支持 B站 & 抖音
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Input Row */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <div className="absolute left-3 top-1/2 -translate-y-1/2">
                <Link2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <Input
                placeholder="粘贴Bilibili或抖音视频链接..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className={cn(
                  'pl-10 pr-10 h-12 text-base transition-all',
                  platform && 'border-primary/30 focus:border-primary'
                )}
                disabled={isLoading}
              />
              {url && !isLoading && (
                <button
                  type="button"
                  onClick={clearUrl}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
                >
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>
            <Button
              type="submit"
              disabled={isLoading || !url.trim()}
              className="h-12 px-6 shadow-md hover:shadow-lg transition-all"
              size="lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  解析中
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  解析视频
                </>
              )}
            </Button>
          </div>

          {/* Platform Detection */}
          {url && platform && (
            <div
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border-2 transition-all',
                platformStyle.bg,
                platformStyle.border
              )}
            >
              <CheckCircle2 className={cn('h-5 w-5', platformStyle.text)} />
              <span className="text-sm text-muted-foreground">检测到平台:</span>
              <Badge
                variant="outline"
                className={cn('font-semibold capitalize', platformStyle.badge)}
              >
                {platform === 'bilibili' ? 'Bilibili' : '抖音'}
              </Badge>
              <Sparkles className={cn('h-4 w-4 ml-auto', platformStyle.text)} />
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive" className="border-2">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription className="font-medium">{error}</AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* URL format hint */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground">支持的链接格式:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] shrink-0">B站</Badge>
                <code className="bg-background px-2 py-1 rounded truncate">
                  bilibili.com/video/BV...
                </code>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] shrink-0">B站短链</Badge>
                <code className="bg-background px-2 py-1 rounded truncate">b23.tv/...</code>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] shrink-0">抖音</Badge>
                <code className="bg-background px-2 py-1 rounded truncate">
                  douyin.com/video/...
                </code>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] shrink-0">抖音短链</Badge>
                <code className="bg-background px-2 py-1 rounded truncate">v.douyin.com/...</code>
              </div>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
