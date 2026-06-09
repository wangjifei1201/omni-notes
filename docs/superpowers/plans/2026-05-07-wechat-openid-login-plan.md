# 微信 Openid 登录实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现基于 openid 的微信授权登录，替代个人主体小程序无法使用的手机号授权

**Architecture:** 前端通过 wx.login() 获取 code → 发到后端换 openid → 后端用 openid 查找/创建用户 → 返回 session

**Tech Stack:** 微信小程序 + FastAPI 后端 + PostgreSQL

---

## 文件改动清单

| 文件 | 改动类型 | 职责 |
|------|----------|------|
| miniprogram/pages/auth/login/index.wxml | 修改 | 按钮改为普通点击 |
| miniprogram/pages/auth/login/index.js | 修改 | 新增 onWechatLogin 方法，调用 wx.login() |
| miniprogram/utils/api.js | 修改 | 新增 wechatLogin 接口 |
| backend/app/routers/auth.py | 修改 | 新增 /wechat-login 端点 |

---

## Task 1: 后端新增 /api/v1/auth/wechat-login 接口

**Files:**
- Modify: `backend/app/routers/auth.py` (在文件末尾新增)

- [ ] **Step 1: 在 auth.py 末尾新增接口代码**

在 `backend/app/routers/auth.py` 末尾（第 455 行之后）添加：

```python
@router.post("/wechat-login")
async def wechat_login(
    http_request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """
    微信 openid 授权登录（个人主体小程序方案）

    1. 前端调用 wx.login() 获取 code
    2. 后端用 code 换 openid
    3. 用 openid 查找/创建用户
    """
    # 获取请求体中的 code
    try:
        body = await http_request.json()
        code = body.get("code")
    except Exception:
        raise HTTPException(status_code=400, detail="缺少 code 参数")

    if not code:
        raise HTTPException(status_code=400, detail="code 不能为空")

    try:
        # 1. 用 code 换 openid
        appid = settings.wechat_miniapp_appid
        secret = settings.wechat_miniapp_secret

        # 调用微信 API 用 code 换 session_key 和 openid
        token_url = "https://api.weixin.qq.com/sns/jscode2session"
        token_params = {
            "appid": appid,
            "secret": secret,
            "js_code": code,
            "grant_type": "authorization_code",
        }

        token_response = requests.get(token_url, params=token_params, timeout=10)
        token_data = token_response.json()

        # 检查微信返回的错误
        if token_data.get("errcode") and token_data["errcode"] != 0:
            errcode = token_data.get("errcode")
            errmsg = token_data.get("errmsg", "Unknown error")
            if errcode == 40029:
                raise HTTPException(status_code=400, detail="授权码无效，请重新登录")
            elif errcode == 40127:
                raise HTTPException(status_code=400, detail="code 已过期，请重新登录")
            else:
                raise HTTPException(status_code=400, detail=f"微信登录失败: {errmsg}")

        openid = token_data.get("openid")
        if not openid:
            raise HTTPException(status_code=500, detail="未能获取用户标识")

        # 2. 用 openid 查找用户
        stmt = select(User).where(User.openid == openid)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user:
            # 已存在用户，更新登录时间
            await UserService.update_last_login(db, user.id)
            await db.commit()
        else:
            # 创建新用户
            user = await UserService.create_user_by_openid(db, openid=openid)

        # 3. 创建 session
        session = await SessionService.create_session(db, user.id)

        # 4. 设置 cookie
        set_session_cookie(response, session.id)

        return {
            "id": user.id,
            "openid": user.openid,
            "username": user.username,
            "is_guest": user.is_guest,
            "session_id": session.id,
        }

    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"微信服务异常，请稍后重试")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"登录失败: {str(e)}")
```

- [ ] **Step 2: 添加 UserService.create_user_by_openid 方法**

查看 `backend/app/services/user_service.py`，找到 `create_user_by_phone` 方法，在附近添加：

```python
@staticmethod
async def create_user_by_openid(db: AsyncSession, openid: str, username: str = None) -> User:
    """通过 openid 创建新用户"""
    if username is None:
        # 生成默认用户名
        username = f"微信用户_{openid[:8]}"

    new_user = User(
        username=username,
        openid=openid,
        is_guest=False,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user
```

- [ ] **Step 3: 验证后端接口存在**

```bash
curl -s -m 10 https://wangxiyue.cloud/api/v1/auth/ -w "\n%{http_code}"
```

预期：返回 200 或其他 JSON 响应（说明路由存在）

- [ ] **Step 4: 提交后端改动**

```bash
git add backend/app/routers/auth.py backend/app/services/user_service.py
git commit -m "feat: 添加微信 openid 登录接口 /api/v1/auth/wechat-login"
```

---

## Task 2: 前端新增 wechatLogin API

**Files:**
- Modify: `miniprogram/utils/api.js` (在 authApi 中新增)

- [ ] **Step 1: 在 authApi 中新增 wechatLogin 方法**

在 `miniprogram/utils/api.js` 的 `authApi` 对象中（约第 145-151 行 `wechatPhoneLogin` 之后）添加：

```javascript
  // 微信 openid 登录
  wechatLogin: (code) => {
    return request('POST', '/auth/wechat-login', {
      code,
    });
  },
```

- [ ] **Step 2: 提交前端 API 改动**

```bash
git add miniprogram/utils/api.js
git commit -m "feat: 添加 wechatLogin API 接口"
```

---

## Task 3: 前端修改登录页面

**Files:**
- Modify: `miniprogram/pages/auth/login/index.wxml`
- Modify: `miniprogram/pages/auth/login/index.js`

- [ ] **Step 1: 修改 login/index.wxml**

将微信登录按钮从：
```xml
<button
  class="btn-wechat"
  open-type="getPhoneNumber"
  bindgetphonenumber="onGetPhoneNumber"
  loading="{{isLoading}}"
  disabled="{{isLoading}}"
>
  微信手机号登录
</button>
```

改为：
```xml
<button
  class="btn-wechat"
  bindtap="onWechatLogin"
  loading="{{isLoading}}"
  disabled="{{isLoading}}"
>
  微信登录
</button>
```

- [ ] **Step 2: 修改 login/index.js**

将 `onGetPhoneNumber` 方法替换为 `onWechatLogin` 方法：

```javascript
  // 微信授权登录（openid 方案）
  onWechatLogin() {
    // 防止重复点击（2秒内只能点击一次）
    const now = Date.now();
    if (now - this.data.lastClickTime < 2000) {
      console.log('防止重复点击，请稍候再试');
      return;
    }
    this.setData({ lastClickTime: now, isLoading: true, error: null });

    // 调用 wx.login 获取 code
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          this.setData({ isLoading: false, error: '获取授权失败，请重试' });
          return;
        }

        console.log('微信登录 code:', loginRes.code);

        // 发送 code 到后端
        authApi.wechatLogin(loginRes.code)
          .then((response) => {
            console.log('登录成功，响应:', response);

            // 保存 session_id
            const sessionId = response.session_id || response.id;
            wx.setStorageSync('auth_token', sessionId);
            wx.setStorageSync('user_id', response.id);

            // 更新全局状态
            store.setUser({
              id: response.id,
              openid: response.openid,
              is_guest: response.is_guest || false,
              username: response.username
            });

            wx.showToast({ title: '登录成功', icon: 'success' });

            setTimeout(() => {
              wx.switchTab({ url: '/pages/index/index' });
            }, 500);
          })
          .catch((error) => {
            console.error('登录失败:', error);
            this.setData({
              error: error.message || '登录失败，请重试',
              isLoading: false,
            });
          });
      },
      fail: (err) => {
        console.error('wx.login 失败:', err);
        this.setData({ isLoading: false, error: '微信授权失败，请重试' });
      }
    });
  },
```

- [ ] **Step 3: 删除不再需要的 onGetPhoneNumber 方法**

从 `login/index.js` 中删除原有的 `onGetPhoneNumber` 方法（原第 16-92 行）。

- [ ] **Step 4: 提交前端改动**

```bash
git add miniprogram/pages/auth/login/index.wxml miniprogram/pages/auth/login/index.js
git commit -m "feat: 改用 openid 方案实现微信登录"
```

---

## Task 4: 整体测试

- [ ] **Step 1: 微信开发者工具中测试**

1. 勾选"不校验合法域名..."（开发阶段）
2. 点击微信登录按钮
3. 确认：
   - Console 无红色报错
   - Network 中有请求发出
   - 登录成功后跳转首页
   - Storage 中有 auth_token 和 user_id

---

## 验证清单

- [ ] 后端 `/api/v1/auth/wechat-login` 接口存在
- [ ] 前端 `authApi.wechatLogin` 方法存在
- [ ] 登录页面按钮可点击
- [ ] 新用户首次登录能创建账户
- [ ] 老用户再次登录能识别

---

## 依赖

- 后端 User 模型已有 `openid` 字段
- 后端 Session 机制已有（复用）
- 后端 Settings 有 `wechat_miniapp_appid` 和 `wechat_miniapp_secret` 配置