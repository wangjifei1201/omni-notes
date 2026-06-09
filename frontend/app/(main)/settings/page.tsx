'use client';

import { useEffect, useState } from 'react';
import {
  Settings,
  User,
  Palette,
  Key,
  Loader2,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { configApi, authApi } from '@/lib/api';
import { useAuthStore, useUIStore } from '@/stores';
import { toast } from 'sonner';
import type { UserConfig } from '@/types';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const { theme, setTheme } = useUIStore();
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const data = await configApi.get();
      setConfig(data);
    } catch {
      toast.error('获取配置失败');
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async (updates: Partial<UserConfig>) => {
    setIsSaving(true);
    try {
      const updated = await configApi.update(updates);
      setConfig(updated);
      toast.success('设置已保存');
    } catch {
      toast.error('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error('密码长度至少为6个字符');
      return;
    }

    try {
      await authApi.changePassword(passwordForm.oldPassword, passwordForm.newPassword);
      toast.success('密码修改成功');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      toast.error('密码修改失败');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-2xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
          设置
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">管理您的账户和偏好设置</p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
            外观
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">自定义界面主题和显示方式</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm">主题</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                选择您喜欢的界面主题
              </p>
            </div>
            <Select value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">浅色</SelectItem>
                <SelectItem value="dark">深色</SelectItem>
                <SelectItem value="system">跟随系统</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* AI Settings */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Brain className="h-4 w-4 sm:h-5 sm:w-5" />
            AI 配置
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">配置 AI 分析服务</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label className="text-sm">AI 模型</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                选择用于视频分析的 AI 模型
              </p>
            </div>
            <Select
              value={config?.model || 'qwen3.5-plus'}
              onValueChange={(v) => saveConfig({ model: v })}
              disabled={isSaving}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>千问</SelectLabel>
                  <SelectItem value="qwen3.5-plus">qwen3.5-plus</SelectItem>
                  <SelectItem value="qwen3-max-2026-01-23">qwen3-max-2026-01-23</SelectItem>
                  <SelectItem value="qwen3-coder-next">qwen3-coder-next</SelectItem>
                  <SelectItem value="qwen3-coder-plus">qwen3-coder-plus</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>智谱</SelectLabel>
                  <SelectItem value="glm-5">glm-5</SelectItem>
                  <SelectItem value="glm-4.7">glm-4.7</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Kimi</SelectLabel>
                  <SelectItem value="kimi-k2.5">kimi-k2.5</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>MiniMax</SelectLabel>
                  <SelectItem value="MiniMax-M2.5">MiniMax-M2.5</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5 flex-1">
              <Label className="text-sm">语音转文字 (Whisper)</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                视频无字幕时使用语音识别
              </p>
            </div>
            <Switch
              checked={config?.use_whisper ?? false}
              onCheckedChange={(v) => saveConfig({ use_whisper: v })}
              disabled={isSaving}
            />
          </div>

          {config?.use_whisper && (
            <>
              <Separator />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label className="text-sm">Whisper 模型</Label>
                  <p className="text-xs sm:text-sm text-muted-foreground">越大的模型越精确但更慢</p>
                </div>
                <Select
                  value={config?.whisper_model || 'base'}
                  onValueChange={(v) => saveConfig({ whisper_model: v })}
                  disabled={isSaving}
                >
                  <SelectTrigger className="w-full sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tiny">Tiny (最快)</SelectItem>
                    <SelectItem value="base">Base (推荐)</SelectItem>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="medium">Medium (最精确)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <User className="h-4 w-4 sm:h-5 sm:w-5" />
            账户信息
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">查看和管理您的账户信息</CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">用户名</Label>
            <Input value={user?.username || ''} disabled className="text-sm" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">注册时间</Label>
            <Input
              value={
                user?.created_at
                  ? new Date(user.created_at).toLocaleDateString('zh-CN')
                  : ''
              }
              disabled
              className="text-sm"
            />
          </div>
          {user?.is_guest && (
            <div className="text-xs sm:text-sm text-muted-foreground">
              您当前是游客模式，已使用 {user.usage_count} 次分析
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Password */}
      {!user?.is_guest && (
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Key className="h-4 w-4 sm:h-5 sm:w-5" />
              修改密码
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">更改您的账户密码</CardDescription>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">当前密码</Label>
              <Input
                type="password"
                value={passwordForm.oldPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, oldPassword: e.target.value })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">新密码</Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                }
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">确认新密码</Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                }
                className="text-sm"
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={
                !passwordForm.oldPassword ||
                !passwordForm.newPassword ||
                !passwordForm.confirmPassword
              }
              className="w-full sm:w-auto"
            >
              修改密码
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
