'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Link2, Loader2, FileText, Download, Mic, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { videoApi, analysisApi } from '@/lib/api';
import { useAnalysisStore } from '@/stores';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { setCurrentVideo, setCurrentTask } = useAnalysisStore();

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const inputUrl = extractUrl(url);
    if (!inputUrl) {
      toast.error('请输入视频链接');
      return;
    }

    if (!platform) {
      toast.error('请输入有效的Bilibili或抖音视频链接');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Parse video (backend also does extract, but send clean URL)
      const video = await videoApi.parse({ url: inputUrl });
      setCurrentVideo(video);
      toast.success('视频解析成功', {
        description: video.title,
      });

      // Step 2: Start analysis directly with comprehensive type
      const videoUrl =
        video.original_url ||
        (video.platform === 'bilibili'
          ? `https://www.bilibili.com/video/${video.video_id}`
          : `https://www.douyin.com/video/${video.video_id}`);

      const taskId = await analysisApi.create({
        url: videoUrl,
        analysis_type: 'comprehensive', // Default to comprehensive analysis
      });

      // Set current task for progress tracking
      setCurrentTask({
        taskId,
        videoId: video.video_id,
        type: 'comprehensive',
        status: 'processing',
        progress: 0,
        message: '开始分析...',
        createdAt: new Date().toISOString(),
      });

      // Navigate to progress page
      router.push('/analyze');
    } catch (err) {
      const message = err instanceof Error ? err.message : '分析启动失败';
      toast.error('分析启动失败', {
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const features = [
    {
      icon: <FileText className="h-5 w-5 sm:h-6 sm:w-6" />,
      title: '分析',
      desc: '提取视频信息和字幕',
    },
    {
      icon: <Download className="h-5 w-5 sm:h-6 sm:w-6" />,
      title: '下载',
      desc: '下载视频音频文件',
    },
    {
      icon: <Mic className="h-5 w-5 sm:h-6 sm:w-6" />,
      title: '语音转义',
      desc: 'Whisper 语音转文字',
    },
    {
      icon: <Brain className="h-5 w-5 sm:h-6 sm:w-6" />,
      title: '大模型分析',
      desc: '纠错并生成摘要观点',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-6rem)] lg:min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Main Input Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-2 sm:px-4 py-6 sm:py-12">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-indigo-500 to-pink-500 bg-clip-text text-transparent">
            Omni-Notes
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-lg mx-auto px-4">
            智能视频笔记助手，一键生成视频摘要、章节和思维导图
          </p>
        </div>

        {/* Input Card */}
        <div className="w-full max-w-2xl px-2 sm:px-0">
          <div className="bg-card border border-border rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-lg sm:shadow-xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Mobile: Stack vertically, Desktop: Horizontal */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Link2 className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  <Input
                    placeholder="粘贴 Bilibili 或抖音视频链接..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className={cn(
                      'pl-10 sm:pl-12 h-12 sm:h-14 text-sm sm:text-base rounded-lg sm:rounded-xl border-2 transition-all',
                      platform && 'border-indigo-500/50 focus:border-indigo-500'
                    )}
                    disabled={isLoading}
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isLoading || !url.trim()}
                  className="h-12 sm:h-14 px-6 sm:px-8 rounded-lg sm:rounded-xl bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 text-white font-semibold shadow-lg hover:shadow-xl transition-all w-full sm:w-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                      <span className="text-sm sm:text-base">解析中</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                      <span className="text-sm sm:text-base">开始分析</span>
                    </>
                  )}
                </Button>
              </div>

              {/* Platform Indicator */}
              {url && platform && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">检测到平台:</span>
                  <span
                    className={cn(
                      'px-2 sm:px-3 py-0.5 sm:py-1 rounded-full font-medium text-xs',
                      platform === 'bilibili'
                        ? 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
                        : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                    )}
                  >
                    {platform === 'bilibili' ? 'Bilibili' : '抖音'}
                  </span>
                </div>
              )}

              {/* URL Format Hint */}
              {!url && (
                <div className="text-xs text-muted-foreground pt-2">
                  <p className="mb-2">支持的链接格式:</p>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    <code className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-muted rounded text-[10px] sm:text-xs">bilibili.com/video/BV...</code>
                    <code className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-muted rounded text-[10px] sm:text-xs">b23.tv/...</code>
                    <code className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-muted rounded text-[10px] sm:text-xs">douyin.com/video/...</code>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Features Showcase - 4 Steps */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mt-8 sm:mt-12 w-full max-w-4xl px-2 sm:px-0">
          {features.map((feature, index) => (
            <div
              key={index}
              className="text-center p-3 sm:p-4 md:p-6 rounded-lg sm:rounded-xl bg-card/50 border border-border/50 hover:border-indigo-500/30 hover:bg-card transition-all group"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-gradient-to-br from-indigo-500/20 to-pink-500/20 text-indigo-500 mb-2 sm:mb-3 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-xs sm:text-sm mb-0.5 sm:mb-1">{feature.title}</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
