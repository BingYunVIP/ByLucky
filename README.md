# ByLucky Phase 1

ByLucky（冰云抽奖）的 V1 基础工程。当前实现严格对应 `ByLucky_V1_PRD.md` 的 Phase 1：Next.js 基础页面、PostgreSQL、完整 Drizzle Schema/Migration、管理员登录与服务端 Session、Worker 进程骨架，以及 Windows 11 开发配置。

活动、奖项、兑换码参与、开奖与邮件业务按 PRD 在后续 Phase 实现。生产 Dockerfile、Caddy 和 Linux VPS Compose 属于 Phase 8，本阶段不提供不可用的占位部署配置。

## 当前能力

- 用户页：`/`
- 管理员登录：`/admin/login`
- 受保护后台：`/admin`
- 管理员认证 API：登录、登出、Session 查询
- PostgreSQL 17 开发容器，宿主机默认端口 `5433`
- PRD 定义的 18 张 Drizzle 数据表和首个 Migration
- Worker 心跳进程，可写入 `worker_heartbeats`
- scrypt 管理员密码、数据库 Session、登录失败限流、同源校验和操作日志

## Windows 11 准备

推荐组合是 Windows 11 + Docker Desktop（WSL 2 backend）+ Node.js 22 LTS。项目也支持直接使用 PowerShell 开发，WSL 2 不是强制要求。

安装并确认以下软件：

- Git
- Node.js 22 LTS 与 npm 10+
- Docker Desktop，并启用 WSL 2 backend
- WSL 2 Ubuntu（推荐）
- VS Code 与仓库推荐扩展（推荐）

PowerShell 环境检查：

```powershell
npm run env:check
```

如需安装 WSL 2，可在管理员 PowerShell 中运行 `wsl --install`，重启 Windows 后安装 Ubuntu。Docker Desktop 的 Settings > General 中启用 WSL 2 engine，并在 Resources > WSL Integration 中启用目标 Ubuntu。

## 首次启动

1. 安装锁定依赖。

```powershell
npm ci
```

2. 从模板建立本地配置。

```powershell
Copy-Item .env.example .env
```

3. 生成三个系统密钥，将输出分别填入 `.env`。

```powershell
npm run secrets:generate
```

4. 交互式生成管理员密码哈希，将输出的完整 `ADMIN_PASSWORD_HASH=...` 行填入 `.env`。密码不会回显，也不会写入数据库或日志。

```powershell
npm run admin:hash-password
```

5. 启动 PostgreSQL 并执行 Migration。

```powershell
docker compose -f docker-compose.dev.yml up -d db
npm run db:migrate
```

6. 启动网站。

```powershell
npm run dev
```

另开一个 PowerShell 窗口启动 Worker：

```powershell
npm run worker:dev
```

访问地址：

- 用户页：<http://localhost:3000>
- 管理后台：<http://localhost:3000/admin>

## WSL 2 启动

在 Ubuntu 中进入仓库后，使用与 PowerShell 相同的 npm 和 Docker Compose 命令。若仓库位于 Windows 盘，路径通常为 `/mnt/d/VibeCoding/Projects/ByLucky`。为了更好的文件监听性能，可把仓库放在 WSL 的 Linux 文件系统中。

Docker Desktop 开启 WSL Integration 后，Ubuntu 内的 `docker compose` 会连接同一个 Docker Desktop 引擎。Windows 浏览器仍可直接访问 `localhost:3000`。

## 环境变量

| 字段 | 用途 |
|---|---|
| `NODE_ENV` | `development`、`test` 或 `production` |
| `APP_URL` | 浏览器访问的规范 Origin；管理员写请求会据此做同源校验 |
| `LOG_LEVEL` | `debug`、`info`、`warn` 或 `error` |
| `DATABASE_URL` | PostgreSQL 连接串；开发默认连接 `localhost:5433` |
| `ADMIN_USERNAME` | 唯一管理员账号，不存数据库 |
| `ADMIN_PASSWORD_HASH` | `npm run admin:hash-password` 生成的 scrypt 哈希，绝不能填写明文密码 |
| `SESSION_SECRET` | IP 哈希和 Session 相关密钥，至少 32 个随机字节 |
| `CODE_HMAC_SECRET` | 后续兑换码精确 HMAC 密钥，至少 32 个随机字节 |
| `CONFIG_ENCRYPTION_KEY` | 后续 SMTP 密码和私密奖品的 AES-256-GCM 密钥 |

`.env` 已被 Git 忽略。不要提交真实密钥。

`CODE_HMAC_SECRET` 在实际导入兑换码后不可随意更换，否则已有兑换码将无法匹配，并会破坏全局重复使用识别。`CONFIG_ENCRYPTION_KEY` 必须单独安全备份，丢失后无法解密 SMTP 密码和私密奖品。生产环境也应备份 `SESSION_SECRET`；更换它至少会改变 IP/限流哈希语义，并应配合清理已有 Session。

## PostgreSQL 与 Drizzle

开发 Compose 只启动 PostgreSQL，不把 Next.js 或 Worker 放入容器，以便 Windows/WSL 中快速热更新。

本机已有其他 PostgreSQL 使用 `5432` 时，ByLucky 默认使用 `5433`。可临时覆盖宿主端口：

```powershell
$env:POSTGRES_PORT = "55432"
docker compose -f docker-compose.dev.yml up -d db
```

此时还需同步修改 `.env` 中 `DATABASE_URL` 的端口。

常用数据库命令：

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run db:studio
```

修改 `src/db/schema` 后先运行 `db:generate`，审查新 Migration SQL，再运行 `db:migrate`。不要在已共享或生产数据库中修改已经执行过的 Migration。

开发数据库状态与停止命令：

```powershell
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml stop db
```

数据保存在命名卷 `bylucky-dev_bylucky_postgres_data` 中，停止或重建容器不会删除该卷。

## 管理员认证

- 密码哈希格式为版本化 scrypt，随机 salt，每次生成结果不同。
- 登录成功生成 32 字节随机 token；Cookie 保存原始 token，数据库只保存 SHA-256。
- Cookie 为 `HttpOnly`、`SameSite=Lax`，生产环境自动启用 `Secure`，Session 有效期 12 小时。
- 登录失败以 HMAC 后的 IP bucket 持久化限流：15 分钟窗口最多 5 次，触发后阻止 15 分钟。
- 登录成功、失败、阻止和登出写入脱敏操作日志，不记录用户名输入或密码。
- 管理员 POST 请求按 `APP_URL` 验证 Origin。
- `/admin` 与 `/api/admin` 返回禁止索引和禁止 iframe 的安全响应头。

认证 API 使用 PRD 统一 JSON 结构：

```text
POST /api/admin/auth/login
POST /api/admin/auth/logout
GET  /api/admin/auth/session
```

## 开发质量命令

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run worker:build
```

一次运行全部静态检查、测试和构建：

```powershell
npm run verify
```

## Worker

开发运行：

```powershell
npm run worker:dev
```

构建和运行独立产物：

```powershell
npm run worker:build
npm run worker:start
```

Phase 1 Worker 每 15 秒更新一次 `worker_heartbeats`。定时开奖、系统任务领取和邮件队列将在对应 Phase 接入同一进程，不引入 Redis 或消息队列。

## 后续生产部署边界

PRD Phase 8 将补齐 `Dockerfile`、生产 `docker-compose.yml`、Caddy HTTPS、每日 `pg_dump`、恢复流程和 Linux VPS 上线步骤。在这些文件完成并经过容器验收前，不应把当前开发 Compose 当作生产配置使用。
