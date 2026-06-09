'use client';

import { useEffect, useState } from 'react';
import {
  FolderOpen,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { groupApi } from '@/lib/api';
import { toast } from 'sonner';
import type { Group } from '@/types';

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [formName, setFormName] = useState('');

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setIsLoading(true);
    try {
      const data = await groupApi.getList();
      setGroups(data);
    } catch {
      toast.error('获取分组失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    try {
      await groupApi.create({ name: formName.trim() });
      toast.success('分组创建成功');
      setIsDialogOpen(false);
      setFormName('');
      fetchGroups();
    } catch {
      toast.error('创建分组失败');
    }
  };

  const handleUpdate = async () => {
    if (!editingGroup || !formName.trim()) return;
    try {
      await groupApi.update(editingGroup.id, { name: formName.trim() });
      toast.success('分组更新成功');
      setIsDialogOpen(false);
      setEditingGroup(null);
      setFormName('');
      fetchGroups();
    } catch {
      toast.error('更新分组失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个分组吗？')) return;
    try {
      await groupApi.delete(id);
      toast.success('分组已删除');
      fetchGroups();
    } catch {
      toast.error('删除分组失败');
    }
  };

  const openCreateDialog = () => {
    setFormName('');
    setEditingGroup(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (group: Group) => {
    setEditingGroup(group);
    setFormName(group.name);
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <FolderOpen className="h-5 w-5 sm:h-6 sm:w-6" />
            分组管理
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">管理您的视频分析分组</p>
        </div>
        <Button onClick={openCreateDialog} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          新建分组
        </Button>
      </div>

      {/* Groups list */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <CardContent className="p-6 sm:p-8 text-center">
            <FolderOpen className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
            <h3 className="font-medium text-sm sm:text-base mb-2">暂无分组</h3>
            <p className="text-xs sm:text-sm text-muted-foreground mb-4">
              创建分组来组织您的视频分析历史
            </p>
            <Button onClick={openCreateDialog} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              新建分组
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <FolderOpen className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                    <h3 className="font-medium text-sm sm:text-base truncate">{group.name}</h3>
                    <Badge variant="secondary" className="text-[10px] sm:text-xs flex-shrink-0">
                      {group.item_count} 项
                    </Badge>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEditDialog(group)}>
                        <Edit2 className="mr-2 h-4 w-4" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(group.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">
              {editingGroup ? '编辑分组' : '新建分组'}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {editingGroup ? '修改分组信息' : '创建一个新的分组来组织视频'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm">分组名称</Label>
              <Input
                placeholder="输入分组名称"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">
              取消
            </Button>
            <Button
              onClick={editingGroup ? handleUpdate : handleCreate}
              disabled={!formName.trim()}
              className="w-full sm:w-auto"
            >
              {editingGroup ? '保存' : '创建'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
