'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Trash2,
  MoreVertical,
  Folder,
  Loader2,
  AlertCircle,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { historyApi, groupApi } from '@/lib/api';
import { toast } from 'sonner';
import type { AnalysisHistory, Group } from '@/types';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('zh-CN');
}

function getPlatformLabel(platform: string): string {
  return platform === 'bilibili' ? 'Bilibili' : '抖音';
}

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<AnalysisHistory[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filterGroup, setFilterGroup] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
    fetchGroups();
  }, [filterGroup]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const response = await historyApi.getList({
        group_id: filterGroup || undefined,
        sort_by: 'created_at',
        sort_order: 'desc',
        limit: 100,
      });
      setHistory(response.items);
    } catch {
      toast.error('获取历史记录失败');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const data = await groupApi.getList();
      setGroups(data);
    } catch {
      // Silent fail
    }
  };

  const moveToGroup = async (taskId: string, groupId: string) => {
    try {
      await groupApi.addTask(groupId, taskId);
      toast.success('已添加到分组');
      fetchHistory();
    } catch {
      toast.error('操作失败');
    }
  };

  const deleteItem = async (id: string) => {
    try {
      await historyApi.delete(id);
      setHistory((items) => items.filter((item) => item.id !== id));
      toast.success('已删除');
    } catch {
      toast.error('删除失败');
    }
  };

  const batchDelete = async () => {
    if (selectedItems.size === 0) return;
    try {
      // Delete one by one since backend doesn't have batch endpoint
      const ids = Array.from(selectedItems);
      for (const id of ids) {
        await historyApi.delete(id);
      }
      setHistory((items) => items.filter((item) => !selectedItems.has(item.id)));
      setSelectedItems(new Set());
      toast.success(`已删除 ${selectedItems.size} 项`);
    } catch {
      toast.error('批量删除失败');
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedItems(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredHistory.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredHistory.map((item) => item.id)));
    }
  };

  const filteredHistory = history.filter((item) =>
    (item.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <History className="h-5 w-5 sm:h-6 sm:w-6" />
          历史记录
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">查看和管理您的视频分析历史</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索视频标题..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 text-sm"
          />
        </div>
        {selectedItems.size > 0 && (
          <Button variant="destructive" size="sm" onClick={batchDelete} className="w-full sm:w-auto">
            <Trash2 className="mr-2 h-4 w-4" />
            删除 ({selectedItems.size})
          </Button>
        )}
      </div>

      {/* Group filters */}
      {groups.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterGroup === null ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterGroup(null)}
            className="text-xs sm:text-sm"
          >
            全部
          </Button>
          {groups.map((group) => (
            <Button
              key={group.id}
              variant={filterGroup === group.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterGroup(group.id)}
              className="text-xs sm:text-sm"
            >
              <Folder className="mr-1 h-3 w-3" />
              {group.name}
              {group.item_count > 0 && (
                <span className="ml-1 text-xs">({group.item_count})</span>
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Select all */}
      {filteredHistory.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={
              selectedItems.size > 0 &&
              selectedItems.size === filteredHistory.length
            }
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-xs sm:text-sm text-muted-foreground">
            全选 ({selectedItems.size}/{filteredHistory.length})
          </span>
        </div>
      )}

      {/* History list */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filteredHistory.length === 0 ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {searchQuery ? '没有找到匹配的记录' : '暂无历史记录'}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2 sm:space-y-3">
          {filteredHistory.map((item) => (
            <Card
              key={item.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => router.push(`/analysis/${item.id}`)}
            >
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-4">
                  <Checkbox
                    checked={selectedItems.has(item.id)}
                    onCheckedChange={() => toggleSelect(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1"
                  />

                  {/* Cover - Hidden on very small screens */}
                  {item.cover && (
                    <img
                      src={item.cover}
                      alt={item.title || '视频封面'}
                      className="hidden sm:block w-20 sm:w-24 h-14 sm:h-16 object-cover rounded-md flex-shrink-0"
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-medium text-sm sm:text-base truncate">{item.title || '未知标题'}</h3>
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] sm:text-xs">
                            {getPlatformLabel(item.platform)}
                          </Badge>
                          {item.author && (
                            <span className="text-[10px] sm:text-xs text-muted-foreground truncate max-w-[80px] sm:max-w-none">
                              {item.author}
                            </span>
                          )}
                          <span className="text-[10px] sm:text-xs text-muted-foreground">
                            {formatDate(item.created_at)}
                          </span>
                          <Badge
                            variant={item.status === 'completed' ? 'default' : 'secondary'}
                            className="text-[10px] sm:text-xs"
                          >
                            {item.status === 'completed' ? '已完成' : item.status}
                          </Badge>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => e.stopPropagation()}
                            className="h-8 w-8 flex-shrink-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {groups.length > 0 && (
                            <>
                              {groups.map((group) => (
                                <DropdownMenuItem
                                  key={group.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveToGroup(item.id, group.id);
                                  }}
                                >
                                  <Folder className="mr-2 h-4 w-4" />
                                  移动到: {group.name}
                                </DropdownMenuItem>
                              ))}
                              <Separator className="my-1" />
                            </>
                          )}
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteItem(item.id);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            删除
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
