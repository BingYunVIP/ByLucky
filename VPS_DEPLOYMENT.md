# ByLucky Linux VPS 部署

本项目的 Linux 部署入口是仓库根目录的 `deploy.sh`。它在 VPS 主机上运行 Next.js production server 和 Worker，并用 Docker Compose 运行 PostgreSQL。数据库默认只监听 `127.0.0.1:5431`。

## 1. 准备主机

建议使用 Ubuntu 24.04 LTS 或同等发行版，并安装：

- Git
- Node.js 22 LTS 和 npm 10+
- Docker Engine
- Docker Compose v2
- Caddy 或 Nginx

将部署用户加入 Docker 用户组后重新登录：

```bash
sudo usermod -aG docker "$USER"
```

确认不需要 root 即可访问 Docker：

```bash
docker info
docker compose version
```

## 2. 获取代码

```bash
git clone https://github.com/BingYunVIP/ByLucky.git
cd ByLucky
npm ci
chmod +x deploy.sh
```

## 3. 首次部署

运行：

```bash
./deploy.sh
```

选择 `1`，输入公开访问地址、管理员账号和至少 12 位管理员密码。脚本会创建 `.env`（权限 `600`）、生成缺失密钥、启动 PostgreSQL、执行 migration、构建 Worker 和 Next.js，然后启动本地运行时。

默认连接配置为：

```text
DATABASE_URL=postgresql://bylucky:bylucky_dev@localhost:5431/bylucky
```

不要把 `.env`、密码、密钥或 `logs/production/` 提交到 Git。

## 4. 反向代理

Next.js 只监听 VPS 本机 `127.0.0.1:3000`。Caddy 示例：

```text
lottery.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

将 `APP_URL` 设置为用户实际访问的 HTTPS 地址。防火墙只开放 SSH、80 和 443；不要开放 5431。

## 5. 更新部署

在维护窗口执行：

```bash
git pull --ff-only origin main
./deploy.sh
```

选择 `1` 会重新构建应用并重启受管的 Web/Worker 进程，PostgreSQL 命名卷不会被删除。

## 6. 修改管理员凭据

选择菜单 `2`。脚本会重新生成 scrypt 密码哈希，不会把明文密码写入日志或命令参数。

## 7. 数据重置

菜单 `3` 只删除本项目 Compose 文件声明的 PostgreSQL 卷。它会保留源码、`.env` 和日志，但会永久删除所有 ByLucky 业务数据。只有在明确需要重新初始化时才输入精确的 `ERASE`。

## 8. 日志与状态

- Web 日志：`logs/production/web.log`
- Worker 日志：`logs/production/worker.log`
- PID 文件：`.bylucky-runtime/`

查看运行状态：

```bash
docker compose -f docker-compose.dev.yml ps
curl -fsS http://127.0.0.1:3000/
```

## 9. 数据备份

至少每天执行一次 PostgreSQL 逻辑备份，并把备份复制到 VPS 之外的安全位置：

```bash
mkdir -p backups
docker compose -f docker-compose.dev.yml exec -T db \
  pg_dump -U bylucky -d bylucky --no-owner --no-privileges \
  | gzip > "backups/bylucky-$(date -u +%Y%m%dT%H%M%SZ).sql.gz"
```

同时备份 `.env` 中的 `CODE_HMAC_SECRET` 和 `CONFIG_ENCRYPTION_KEY`。丢失它们会使历史兑换码或加密 SMTP/奖品内容无法恢复。
