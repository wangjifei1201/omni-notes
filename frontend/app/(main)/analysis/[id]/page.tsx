'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  FileText,
  List,
  GitBranch,
  Clock,
  ChevronLeft,
  Loader2,
  AlertCircle,
  FolderOpen,
  Plus,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { analysisApi, groupApi } from '@/lib/api';
import { toast } from 'sonner';
import type { AnalysisResult, AnalysisResultData, MindMapNode, Group } from '@/types';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Group Manager Component
function GroupManager({ taskId }: { taskId: string }) {
  const [taskGroups, setTaskGroups] = useState<Group[]>([]);
  const [allGroups, setAllGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const fetchGroups = useCallback(async () => {
    try {
      const [taskGrps, allGrps] = await Promise.all([
        groupApi.getByTask(taskId),
        groupApi.getList(),
      ]);
      setTaskGroups(taskGrps);
      setAllGroups(allGrps);
    } catch {
      // Silently fail - groups are not critical
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleAddToGroup = async (groupId: string) => {
    try {
      await groupApi.addTask(groupId, taskId);
      toast.success('已添加到分组');
      await fetchGroups();
    } catch {
      toast.error('添加到分组失败');
    }
  };

  const handleRemoveFromGroup = async (groupId: string) => {
    try {
      await groupApi.removeTask(groupId, taskId);
      toast.success('已从分组移除');
      await fetchGroups();
    } catch {
      toast.error('从分组移除失败');
    }
  };

  const handleCreateAndAdd = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setIsCreating(true);
    try {
      const group = await groupApi.create({ name });
      await groupApi.addTask(group.id, taskId);
      toast.success(`已创建分组"${name}"并添加`);
      setNewGroupName('');
      setDropdownOpen(false);
      await fetchGroups();
    } catch {
      toast.error('创建分组失败');
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) return null;

  // Groups NOT yet assigned to this task
  const taskGroupIds = new Set(taskGroups.map((g) => g.id));
  const availableGroups = allGroups.filter((g) => !taskGroupIds.has(g.id));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground flex items-center gap-1">
        <FolderOpen className="h-3.5 w-3.5" />
        分组:
      </span>

      {/* Current groups as badges */}
      {taskGroups.map((group) => (
        <Badge key={group.id} variant="secondary" className="gap-1 pr-1">
          {group.name}
          <button
            onClick={() => handleRemoveFromGroup(group.id)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {/* Add to group dropdown */}
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1">
            <Plus className="h-3 w-3" />
            {taskGroups.length === 0 ? '添加到分组' : '添加'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {availableGroups.length > 0 ? (
            availableGroups.map((group) => (
              <DropdownMenuItem
                key={group.id}
                onClick={() => handleAddToGroup(group.id)}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                {group.name}
                <span className="ml-auto text-xs text-muted-foreground">
                  {group.item_count} 项
                </span>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              {allGroups.length === 0 ? '暂无分组' : '已添加到所有分组'}
            </div>
          )}
          <DropdownMenuSeparator />
          <div className="p-2">
            <div className="flex gap-1.5">
              <Input
                placeholder="新分组名称"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') handleCreateAndAdd();
                }}
                className="h-7 text-sm"
              />
              <Button
                size="sm"
                className="h-7 px-2"
                disabled={!newGroupName.trim() || isCreating}
                onClick={handleCreateAndAdd}
              >
                {isCreating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Summary View
function SummaryView({ result }: { result: AnalysisResultData }) {
  if (!result?.summary) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          内容摘要
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose max-w-none">
          {result.summary.split('\n').map((paragraph, index) => (
            <p key={index} className="mb-4 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Key Points View
function KeyPointsView({ result }: { result: AnalysisResultData }) {
  if (!result?.key_points?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <List className="h-5 w-5" />
          关键要点
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {result.key_points.map((item, index) => (
            <li key={index} className="flex gap-3">
              <span className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                {index + 1}
              </span>
              <div>
                <span className="font-medium leading-relaxed">{item.point}</span>
                {item.detail && (
                  <p className="text-sm text-muted-foreground mt-1">{item.detail}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// Chapters View
function ChaptersView({ result }: { result: AnalysisResultData }) {
  if (!result?.chapters?.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          章节分析
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {result.chapters.map((chapter, index) => (
            <div key={index} className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{index + 1}</Badge>
                <h3 className="font-semibold">{chapter.title}</h3>
                <span className="text-sm text-muted-foreground ml-auto">
                  {chapter.time}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {chapter.summary}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Mind Map View
function MindMapView({ result }: { result: AnalysisResultData }) {
  if (!result?.mindmap) return null;

  const mindmap = result.mindmap;

  // Handle the backend format: {root: string, branches: [{title, items}]}
  if (mindmap.root && mindmap.branches) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            思维导图
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="font-bold text-lg">{mindmap.root}</div>
            {mindmap.branches.map((branch, index) => (
              <div key={index} className="ml-6 mt-2">
                <div className="font-semibold text-base flex items-start gap-2">
                  <span className="text-muted-foreground mt-1">-</span>
                  <span>{branch.title}</span>
                </div>
                {branch.items && branch.items.length > 0 && (
                  <div className="ml-6 mt-1">
                    {branch.items.map((item, itemIdx) => (
                      <div key={itemIdx} className="text-sm flex items-start gap-2 mt-1">
                        <span className="text-muted-foreground mt-0.5">&#x2022;</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fallback: Recursive tree rendering
  function renderNode(node: MindMapNode, level = 0): React.ReactNode {
    if (!node) return null;
    const indent = level * 24;
    const title = node.title || node.root || '';

    return (
      <div key={title} className={level > 0 ? 'mt-2' : ''}>
        <div
          className={`flex items-start gap-2 ${
            level === 0
              ? 'font-bold text-lg'
              : level === 1
              ? 'font-semibold text-base'
              : 'text-sm'
          }`}
          style={{ marginLeft: `${indent}px` }}
        >
          {level > 0 && (
            <span className="text-muted-foreground mt-1">&#x2022;</span>
          )}
          <span>{title}</span>
        </div>
        {node.children && node.children.length > 0 && (
          <div className="mt-2">
            {node.children.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          思维导图
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">{renderNode(mindmap)}</div>
      </CardContent>
    </Card>
  );
}

export default function AnalysisResultPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    if (!taskId) {
      setError('无效的分析ID');
      setIsLoading(false);
      return;
    }

    fetchAnalysisResult();
  }, [taskId]);

  const fetchAnalysisResult = async () => {
    setIsLoading(true);
    try {
      const data = await analysisApi.getById(taskId);
      setResult(data);

      // Set initial active tab based on content
      if (data.result) {
        if (data.result.summary) setActiveTab('summary');
        else if (data.result.key_points) setActiveTab('keypoints');
        else if (data.result.chapters) setActiveTab('chapters');
        else if (data.result.mindmap) setActiveTab('mindmap');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取分析结果失败';
      setError(message);
      toast.error('获取分析结果失败', {
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        <Button onClick={() => router.push('/')}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          返回首页
        </Button>
      </div>
    );
  }

  if (!result || !result.result) {
    return (
      <Alert>
        <AlertDescription>分析结果不存在</AlertDescription>
      </Alert>
    );
  }

  const analysisData = result.result;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/')}
            className="mb-2"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            返回
          </Button>
          <h1 className="text-2xl font-bold">{result.title || '分析结果'}</h1>
        </div>
        <Badge variant="outline">{result.platform === 'bilibili' ? 'Bilibili' : '抖音'}</Badge>
      </div>

      {/* Meta info */}
      <div className="text-sm text-muted-foreground space-y-1">
        {result.author && <p>作者: {result.author}</p>}
        <p>分析时间: {formatDate(result.created_at)}</p>
        {result.status && <p>状态: {result.status === 'completed' ? '已完成' : result.status}</p>}
      </div>

      {/* Group management */}
      <GroupManager taskId={taskId} />

      <Separator />

      {/* Tabs for structured content */}
      {(analysisData.summary ||
        analysisData.key_points?.length ||
        analysisData.chapters?.length ||
        analysisData.mindmap) && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            {analysisData.summary && (
              <TabsTrigger value="summary">摘要</TabsTrigger>
            )}
            {analysisData.key_points?.length ? (
              <TabsTrigger value="keypoints">要点</TabsTrigger>
            ) : null}
            {analysisData.chapters?.length ? (
              <TabsTrigger value="chapters">章节</TabsTrigger>
            ) : null}
            {analysisData.mindmap && (
              <TabsTrigger value="mindmap">思维导图</TabsTrigger>
            )}
          </TabsList>

          <div className="mt-6">
            <TabsContent value="summary">
              <SummaryView result={analysisData} />
            </TabsContent>
            <TabsContent value="keypoints">
              <KeyPointsView result={analysisData} />
            </TabsContent>
            <TabsContent value="chapters">
              <ChaptersView result={analysisData} />
            </TabsContent>
            <TabsContent value="mindmap">
              <MindMapView result={analysisData} />
            </TabsContent>
          </div>
        </Tabs>
      )}

      {/* Transcript */}
      {result.transcript && (
        <Card>
          <CardHeader>
            <CardTitle>完整字幕</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">
              {result.transcript}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
