# 微信 OpenID 登录清理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除旧微信手机号登录路径，保留并修复微信 openid 登录，让个人主体小程序可稳定登录。

**Architecture:** 小程序端只保留 `wx.login() -> authApi.wechatLogin(code) -> /api/v1/auth/wechat-login`。后端删除 `/wechat-phone-login` 和手机号创建用户辅助函数，openid 用户创建时写入随机密码哈希以满足现有数据库非空约束。文档改为只描述 openid 微信登录。

**Tech Stack:** 微信小程序 JavaScript/WXML，FastAPI，Pydantic，async SQLAlchemy，Alembic 既有迁移结构。

---

## File Structure

- Modify: `miniprogram/utils/api.js` — 删除旧手机号登录 API 封装，只保留 `wechatLogin(code)`。
- Modify: `backend/app/services/user_service.py` — 删除 `create_user_by_phone()`，修复 `create_user_by_openid()` 写入 `password_hash`。
- Modify: `backend/app/routers/auth.py` — 删除微信手机号登录请求/响应模型和 `/wechat-phone-login` 路由，删除不再使用的解密 import。
- Modify/Delete docs:
  - Delete: `miniprogram/PHONE_LOGIN_GUIDE.md`
  - Delete: `miniprogram/WECHAT_LOGIN_FIX.md`
  - Delete: `miniprogram/WECHAT_LOGIN_TEST_GUIDE.md`
  - Delete: `docs/微信手机登录实现.md`
  - Delete: `docs/微信手机登录-后端实现.md`
  - Modify: `docs/apis/接口文档.md` — 移除 `/wechat-phone-login`，补充 `/wechat-login`。
  - Modify: `miniprogram/DEVELOPMENT_GUIDE.md` — 将微信登录接口从 `/auth/wechat-phone-login` 改为 `/auth/wechat-login`。
  - Modify: `miniprogram/QUICK_TEST.md`、`miniprogram/TEST_CHECKLIST.md`、`docs/认证修复成功.md`、`docs/认证401问题修复.md` — 删除或改写手机号登录残留。

## Task 1: Clean Mini Program Auth API

**Files:**
- Modify: `miniprogram/utils/api.js:131-158`

- [ ] **Step 1: Inspect current auth API block**

Read `miniprogram/utils/api.js` around the `authApi` object and confirm these functions exist before editing:

```js
sendPhoneCode: (phone) => {
  return request('POST', '/auth/send-phone-code', {
    phone,
  });
},

phoneLogin: (phone, code) => {
  return request('POST', '/auth/phone-login', {
    phone,
    code,
  });
},

wechatPhoneLogin: (code) => {
  return request('POST', '/auth/wechat-phone-login', {
    code,
  });
},
```

- [ ] **Step 2: Remove old phone login functions**

Replace the block from `// 发送手机号验证码` through the end of `wechatPhoneLogin` with this single openid login block:

```js
  // 微信 openid 登录
  wechatLogin: (code) => {
    return request('POST', '/auth/wechat-login', {
      code,
    });
  },
```

Ensure the `authApi` object still has valid commas before and after this block.

- [ ] **Step 3: Verify no mini program code calls removed functions**

Run:

```bash
grep -R "sendPhoneCode\|phoneLogin\|wechatPhoneLogin\|wechat-phone-login\|getPhoneNumber" miniprogram --exclude-dir=node_modules
```

Expected: only documentation files may still match at this stage. No `.js` or `.wxml` runtime file should call these removed functions.

## Task 2: Fix Backend OpenID User Creation

**Files:**
- Modify: `backend/app/services/user_service.py:5-16`
- Modify: `backend/app/services/user_service.py:57-115`

- [ ] **Step 1: Remove unused random/string imports if only used by phone creation**

After deleting `create_user_by_phone()`, check whether `random` and `string` are still used in `backend/app/services/user_service.py`. If not, remove these imports:

```python
import random
import string
```

Keep these imports:

```python
from datetime import datetime
from typing import Optional, List, Tuple
```

- [ ] **Step 2: Delete create_user_by_phone**

Remove this whole method from `UserService`:

```python
    @staticmethod
    async def create_user_by_phone(
        db: AsyncSession, phone: str, openid: str, username: str
    ) -> User:
        """
        Create a new user by phone number (WeChat login).
        """
        random_password = "".join(
            random.choices(string.ascii_letters + string.digits, k=32)
        )

        user = User(
            id=generate_uuid(),
            username=username,
            password_hash=hash_password(random_password),
            phone=phone,
            openid=openid,
            is_guest=False,
            usage_count=0,
            created_at=datetime.utcnow(),
            last_login_at=datetime.utcnow(),
        )

        db.add(user)
        await db.commit()
        await db.refresh(user)

        return user
```

- [ ] **Step 3: Add password_hash to openid users**

Change `create_user_by_openid()` so the `User(...)` construction includes a random password hash:

```python
    @staticmethod
    async def create_user_by_openid(db: AsyncSession, openid: str, username: str = None) -> User:
        """
        Create a new user by WeChat openid.
        """
        if username is None:
            username = f"微信用户_{openid[:8]}"

        new_user = User(
            id=generate_uuid(),
            username=username,
            password_hash=hash_password(generate_uuid()),
            openid=openid,
            is_guest=False,
            usage_count=0,
            created_at=datetime.utcnow(),
            last_login_at=datetime.utcnow(),
        )
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        return new_user
```

This preserves the existing `users.password_hash NOT NULL` schema without adding a migration.

- [ ] **Step 4: Verify backend service syntax**

Run:

```bash
cd backend && python -m py_compile app/services/user_service.py
```

Expected: no output and exit code 0.

## Task 3: Remove Backend WeChat Phone Login Route

**Files:**
- Modify: `backend/app/routers/auth.py:1-33`
- Modify: `backend/app/routers/auth.py:322-455`

- [ ] **Step 1: Remove unused WeChat decrypt import**

Delete this import if it becomes unused:

```python
from app.utils.wechat_decrypt import WeChatDecrypt, WeChatDecryptError
```

Keep `requests`, because `/wechat-login` still calls WeChat `jscode2session`.

- [ ] **Step 2: Delete phone login request/response models**

Remove these classes entirely:

```python
class WeChatPhoneLoginRequest(BaseModel):
    """微信手机号授权登录请求（新版API）"""

    code: str


class WeChatPhoneLoginResponse(BaseModel):
    """微信手机号授权登录响应"""

    id: str
    phone: Optional[str] = None
    is_guest: bool = False
    username: Optional[str] = None
    usage_count: int = 0
    session_id: Optional[str] = None
```

- [ ] **Step 3: Delete /wechat-phone-login route**

Remove the whole route from `@router.post("/wechat-phone-login"...)` through the final exception handler before `@router.post("/wechat-login")`.

After deletion, the file should flow directly from `change_password()` to:

```python
@router.post("/wechat-login")
async def wechat_login(
    http_request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
```

- [ ] **Step 4: Verify no backend phone login symbols remain**

Run:

```bash
grep -R "WeChatPhoneLogin\|wechat-phone-login\|create_user_by_phone\|getuserphonenumber\|getPhoneNumber" backend/app backend/versions
```

Expected: no matches in `backend/app`. Migration files may still contain historical `phone` columns; do not edit migrations for this task.

- [ ] **Step 5: Verify auth router syntax**

Run:

```bash
cd backend && python -m py_compile app/routers/auth.py app/services/user_service.py
```

Expected: no output and exit code 0.

## Task 4: Clean Documentation References

**Files:**
- Delete: `miniprogram/PHONE_LOGIN_GUIDE.md`
- Delete: `miniprogram/WECHAT_LOGIN_FIX.md`
- Delete: `miniprogram/WECHAT_LOGIN_TEST_GUIDE.md`
- Delete: `docs/微信手机登录实现.md`
- Delete: `docs/微信手机登录-后端实现.md`
- Modify: `docs/apis/接口文档.md`
- Modify: `miniprogram/DEVELOPMENT_GUIDE.md`
- Modify: `miniprogram/QUICK_TEST.md`
- Modify: `miniprogram/TEST_CHECKLIST.md`
- Modify: `docs/认证修复成功.md`
- Modify: `docs/认证401问题修复.md`

- [ ] **Step 1: Delete dedicated phone-login docs**

Remove these obsolete docs because they describe an unsupported personal-account flow:

```bash
rm "miniprogram/PHONE_LOGIN_GUIDE.md" \
   "miniprogram/WECHAT_LOGIN_FIX.md" \
   "miniprogram/WECHAT_LOGIN_TEST_GUIDE.md" \
   "docs/微信手机登录实现.md" \
   "docs/微信手机登录-后端实现.md"
```

- [ ] **Step 2: Update API docs**

In `docs/apis/接口文档.md`, remove the section for:

```markdown
### 1.8 微信手机号登录（新API）
```

Replace it with this section:

```markdown
### 1.8 微信 openid 登录

**Endpoint**: `POST /api/v1/auth/wechat-login`

**说明**: 个人主体小程序不能使用获取手机号能力，微信登录统一使用 `wx.login()` 返回的 `code` 换取 `openid`。

**请求体**:
```json
{
  "code": "微信登录 code"
}
```

**响应**:
```json
{
  "id": "user_id",
  "openid": "openid",
  "username": "微信用户_xxxxxxxx",
  "is_guest": false,
  "session_id": "session_id"
}
```
```

- [ ] **Step 3: Update mini program guide endpoint references**

In `miniprogram/DEVELOPMENT_GUIDE.md`, replace references to:

```text
/auth/wechat-phone-login
```

with:

```text
/auth/wechat-login
```

Also change any label like `微信手机号登录` to `微信 openid 登录`.

- [ ] **Step 4: Clean quick test/checklist stale warnings**

In these files:

```text
miniprogram/QUICK_TEST.md
miniprogram/TEST_CHECKLIST.md
docs/认证修复成功.md
docs/认证401问题修复.md
```

Remove instructions that tell testers to use or avoid 微信手机号授权登录. Replace the relevant test wording with:

```markdown
- 点击“微信登录”
- 小程序调用 `wx.login()` 获取 code
- 后端 `/api/v1/auth/wechat-login` 使用 code 换取 openid
- 登录成功后本地保存 `auth_token` 和 `user_id`
```

- [ ] **Step 5: Verify documentation no longer advertises phone login**

Run:

```bash
grep -R "wechat-phone-login\|wechatPhoneLogin\|getPhoneNumber\|微信手机号授权登录\|手机号验证码登录" miniprogram docs --exclude-dir=node_modules
```

Expected: no matches, except historical design/plan files under `docs/superpowers/` may still mention the old migration context. Do not edit old superpowers spec/plan history unless explicitly required.

## Task 5: Final Verification

**Files:**
- Verify only; no planned edits.

- [ ] **Step 1: Check runtime code for deleted symbols**

Run:

```bash
grep -R "wechat-phone-login\|wechatPhoneLogin\|sendPhoneCode\|phoneLogin\|getPhoneNumber\|create_user_by_phone\|WeChatPhoneLogin" backend/app miniprogram --exclude-dir=node_modules
```

Expected: no matches in runtime code.

- [ ] **Step 2: Compile backend files**

Run:

```bash
cd backend && python -m py_compile app/routers/auth.py app/services/user_service.py app/models/user.py app/dependencies.py
```

Expected: no output and exit code 0.

- [ ] **Step 3: Run frontend lint if environment supports it**

Run:

```bash
cd frontend && npm run lint
```

Expected: lint completes. If `next lint` is unavailable due to dependency or Next version behavior, record the exact error and continue only if the edited files are not in `frontend/`.

- [ ] **Step 4: Check git diff**

Run:

```bash
git diff -- miniprogram/utils/api.js backend/app/services/user_service.py backend/app/routers/auth.py docs miniprogram
```

Expected: diff shows only phone-login cleanup, openid password hash fix, and documentation updates.

---

## Self-Review

- Spec coverage: Existing openid login remains the only微信登录 path; old phone login runtime code is deleted; `password_hash` NOT NULL issue is fixed by hashing a generated UUID.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: Removed symbols are `sendPhoneCode`, `phoneLogin`, `wechatPhoneLogin`, `WeChatPhoneLoginRequest`, `WeChatPhoneLoginResponse`, `create_user_by_phone`; retained symbol is `wechatLogin(code)` and `/wechat-login`.
