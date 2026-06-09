'use client';

import { Clock, User, X, Video as VideoIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAnalysisStore } from '@/stores';
import { cn } from '@/lib/utils';
import type { Video } from '@/types';

interface VideoPreviewProps {
  video: Video;
  onClear?: () => void;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    return `${hours}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function VideoPreview({ video, onClear }: VideoPreviewProps) {
  const { setCurrentVideo } = useAnalysisStore();

  const handleClear = () => {
    setCurrentVideo(null);
    onClear?.();
  };

  const thumbnailUrl = video.cover || '';
  const description = video.desc || '';

  const isBilibili = video.platform === 'bilibili';
  const platformColors = isBilibili
    ? {
        bg: 'bg-gradient-to-br from-pink-500/10 to-rose-500/5',
        badge: 'bg-pink-100 text-pink-700 border-pink-200',
        icon: 'text-pink-500',
      }
    : {
        bg: 'bg-gradient-to-br from-cyan-500/10 to-blue-500/5',
        badge: 'bg-cyan-100 text-cyan-700 border-cyan-200',
        icon: 'text-cyan-500',
      };

  return (
    <Card className="w-full overflow-hidden border-2 shadow-lg">
      <CardHeader className={cn('pb-4', platformColors.bg)}>
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 bg-white/80 rounded-lg shadow-sm">
            <VideoIcon className={cn('h-5 w-5', platformColors.icon)} />
          </div>
          视频预览
          <Badge variant="outline" className={cn('ml-auto font-normal', platformColors.badge)}>
            {isBilibili ? 'Bilibili' : '抖音'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row">
          {/* Thumbnail */}
          {thumbnailUrl && (
            <div className="relative w-full md:w-72 h-44 md:h-auto flex-shrink-0 bg-muted">
              <img
                src={thumbnailUrl}
                alt={video.title}
                className="w-full h-full object-cover"
              />
              {video.duration && (
                <div className="absolute bottom-3 right-3 bg-black/80 text-white text-sm px-2.5 py-1 rounded-md font-medium">
                  {formatDuration(video.duration)}
                </div>
              )}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg line-clamp-2 text-foreground">
                  {video.title}
                </h3>
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="truncate font-medium">{video.author}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClear}
                className="flex-shrink-0 hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {description && (
              <p className="text-sm text-muted-foreground mt-3 line-clamp-2 bg-muted/50 rounded-lg p-3">
                {description}
              </p>
            )}

            <Separator className="my-4" />

            <div className="flex flex-wrap gap-4 text-sm">
              {video.duration && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 rounded-full text-amber-700">
                  <Clock className="h-4 w-4" />
                  <span className="font-medium">{formatDuration(video.duration)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
