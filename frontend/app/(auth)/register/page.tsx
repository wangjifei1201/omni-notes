'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/stores';
import { toast } from 'sonner';

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (formData.password.length < 6) {
      setError('密码长度至少为6个字符');
      return;
    }

    setIsLoading(true);

    try {
      // Backend only accepts username and password
      const user = await authApi.register({
        username: formData.username,
        password: formData.password,
      });
      login(user);
      toast.success('注册成功', {
        description: `欢迎，${user.username}！`,
      });
      router.push('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : '注册失败';
      setError(message);
      toast.error('注册失败', {
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-sm sm:max-w-md">
        <CardHeader className="space-y-1 text-center p-4 sm:p-6">
          <div className="flex justify-center mb-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold">
            创建账号
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            开始使用 Omni-Notes
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm">用户名</Label>
              <Input
                id="username"
                placeholder="请输入用户名"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                disabled={isLoading}
                required
                minLength={3}
                className="text-sm h-10 sm:h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="请输入邮箱"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                disabled={isLoading}
                required
                className="text-sm h-10 sm:h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码（至少6个字符）"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                disabled={isLoading}
                required
                minLength={6}
                className="text-sm h-10 sm:h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm">确认密码</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="请再次输入密码"
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                disabled={isLoading}
                required
                className="text-sm h-10 sm:h-11"
              />
            </div>
            <Button type="submit" className="w-full h-10 sm:h-11 text-sm" disabled={isLoading}>
              {isLoading ? '注册中...' : '注册'}
            </Button>
          </form>
          <div className="mt-4 sm:mt-6 text-center">
            <p className="text-xs sm:text-sm text-muted-foreground">
              已有账号？{' '}
              <Link href="/login" className="text-primary hover:underline font-medium">
                立即登录
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
