# ByLucky

ByLucky（冰云抽奖）V1 是一个面向公开参与和管理员运营的抽奖应用。它包含活动创建、核实兑换码导入、邮箱参与、自动或手动开奖、中奖结果、邮件队列和运维记录；所有业务数据均使用 PostgreSQL 持久化。

Linux VPS 使用 `deploy.sh` 管理宿主机上的 Next.js/Worker 进程和 Compose PostgreSQL；公网 HTTPS 仍应由 VPS 上已有的 Caddy 或 Nginx 反向代理负责。

## 当前能力

- 用户页：`/`
- 管理员登录：`/admin/login`
- 受保护后台：`/admin`
- 管理员认证 API：登录、登出、Session 查询
- 活动创建、奖项配置、核实兑换码导入和启动
- 邮箱加兑换码参与，同邮箱多码累计，不同邮箱计入目标人数
- Worker 自动开奖、手动开奖、指定时间开奖、兑换码清理和中奖记录
- 公开脱敏中奖展示、后台获奖记录、SMTP 配置、邮件任务队列和运维日志
- PostgreSQL 17 容器，宿主机默认端口 `5431`（仅绑定 `127.0.0.1`）
- Drizzle schema、versioned migration 和默认系统设置
- Worker 心跳和数据库驱动的后台任务处理
- scrypt 管理员密码、数据库 Session、登录失败限流、同源校验和操作日志

## Linux VPS 部署

VPS 需要 Linux、Node.js 22、npm 10+、Docker Engine 和 Docker Compose v2。部署用户应加入 `docker` 用户组，不要用 root 运行整个应用。

```bash
git clone https://github.com/BingYunVIP/ByLucky.git
cd ByLucky
npm ci
chmod +x deploy.sh
./deploy.sh
```

菜单会要求输入管理员账号和密码，并完成以下步骤：

- 创建或修复 `.env`，自动生成缺失的应用密钥。
- 启动仅绑定 `127.0.0.1:5431` 的 PostgreSQL。
- 执行 Drizzle migration、Worker 构建和 Next.js production build。
- 将 Web/Worker 日志写入 `logs/production/`，进程号写入 `.bylucky-runtime/`。

生产域名应由 Caddy/Nginx 代理到 `127.0.0.1:3000`，防火墙只开放 SSH、HTTP 和 HTTPS，不要公开 PostgreSQL 端口。完整 VPS 操作清单见 [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md)。

## Windows 11 本地准备

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
| `DATABASE_URL` | PostgreSQL 连接串；默认连接 `localhost:5431` |
| `ADMIN_USERNAME` | 唯一管理员账号，不存数据库 |
| `ADMIN_PASSWORD_HASH` | `npm run admin:hash-password` 生成的 scrypt 哈希，绝不能填写明文密码 |
| `SESSION_SECRET` | IP 哈希和 Session 相关密钥，至少 32 个随机字节 |
| `CODE_HMAC_SECRET` | 已导入兑换码的精确 HMAC 密钥，至少 32 个随机字节 |
| `CONFIG_ENCRYPTION_KEY` | SMTP 密码和私密奖品的 AES-256-GCM 密钥 |

`.env` 已被 Git 忽略。不要提交真实密钥。

`CODE_HMAC_SECRET` 在实际导入兑换码后不可随意更换，否则已有兑换码将无法匹配，并会破坏全局重复使用识别。`CONFIG_ENCRYPTION_KEY` 必须单独安全备份，丢失后无法解密 SMTP 密码和私密奖品。生产环境也应备份 `SESSION_SECRET`；更换它至少会改变 IP/限流哈希语义，并应配合清理已有 Session。

## PostgreSQL 与 Drizzle

开发 Compose 只启动 PostgreSQL，不把 Next.js 或 Worker 放入容器，以便 Windows/WSL 中快速热更新。

本机已有其他 PostgreSQL 使用 `5432` 时，ByLucky 默认使用 `5431`。可临时覆盖宿主端口：

```bash
export POSTGRES_PORT=55432
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

Worker 每 15 秒更新一次 `worker_heartbeats`，并处理数据库中的定时开奖、核实码清理和邮件任务；不需要 Redis 或额外消息队列。

## 生产边界

当前生产入口是 Linux 主机上的 `deploy.sh` + PostgreSQL Compose 服务。应用进程不放进开发 Compose 容器，便于迁移和日志排查；公网入口必须由 VPS 上的 Caddy/Nginx 提供 HTTPS 和反向代理。上线前请按 [VPS_DEPLOYMENT.md](VPS_DEPLOYMENT.md) 配置备份、进程守护和防火墙。
