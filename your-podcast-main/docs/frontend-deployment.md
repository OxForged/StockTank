# 前端部署指南

> 平台：Vercel | 区域：Portland, USA (West)
> URL：https://your-podcast.vercel.app

## 架构

```
GitHub push / vercel --prod → Vercel 自动构建 Next.js → 部署到边缘节点
```

## 当前配置

| 项目 | 值 |
|------|-----|
| 平台 | Vercel (Hobby Plan, 免费) |
| 构建区域 | Portland, USA (West) — pdx1 |
| CDN | Vercel Edge Network (全球) |
| 框架 | Next.js 16.1.6 + React 19 |
| 语言 | TypeScript |
| 样式 | Tailwind CSS 4 |
| 包管理 | npm |
| Node | 24.x |

## 页面

| 路径 | 说明 | 状态 |
|------|------|------|
| `/` | 首页 / 播放器 | 已上线 |
| `/archive` | 往期列表 | 待开发 |

## 验证

```bash
curl https://your-podcast.vercel.app
# → 返回 HTML，页面显示 "Your Podcast" + 后端状态绿灯
```

## 部署方式

### 方式一：CLI 手动部署

```bash
cd frontend
vercel --prod --yes
```

### 方式二：Git 推送自动部署

在 Vercel Dashboard 关联 GitHub Repo 后，每次 push 到 main 会自动重新部署。

设置方法：
1. 打开 https://vercel.com → 进入 your-podcast 项目
2. Settings → Git → Connected Git Repository
3. 选择 `Davie521/your-podcast`
4. 设置 Root Directory 为 `frontend`
5. 之后每次 `git push origin main` 自动部署

## 环境变量

在 Vercel Dashboard → 项目 → Settings → Environment Variables 中设置：

| 变量 | 说明 | 环境 | 是否必填 |
|------|------|------|---------|
| `NEXT_PUBLIC_API_URL` | 后端 Railway 地址 | Production | 是 |

> 注意：`NEXT_PUBLIC_` 前缀的变量会在构建时内联到 JS bundle 中，修改后需要重新部署才生效。

当前值：
```
NEXT_PUBLIC_API_URL = https://your-podcast-production.up.railway.app
```

## 与后端的连接

前端通过 `NEXT_PUBLIC_API_URL` 调用后端 API。后端需要在 CORS 中允许前端域名：

| 方向 | 配置 |
|------|------|
| 前端 → 后端 | `NEXT_PUBLIC_API_URL` 指向 Railway URL |
| 后端 → 前端 | Railway 的 `FRONTEND_URL` 设为 Vercel URL（CORS 允许） |

## 常用 Vercel CLI 命令

```bash
# 部署到生产环境
vercel --prod --yes

# 查看环境变量
vercel env ls

# 添加环境变量
vercel env add NEXT_PUBLIC_API_URL production

# 拉取环境变量到本地 .env.local
vercel env pull

# 查看项目列表
vercel project ls

# 查看部署日志
vercel inspect <deployment-url> --logs

# 重新部署
vercel redeploy <deployment-url>
```

## 踩坑记录

### 1. 项目名默认用目录名

Vercel 默认用当前目录名作为项目名（`frontend`），需要用 `--name` 指定：
```bash
vercel --name your-podcast --prod --yes
```
注意：`--name` 已废弃但仍可用，也可以在首次部署时手动选择项目名。

### 2. 从根目录运行会检测到 Python

在项目根目录运行 `vercel` 会检测到 backend 的 Python 项目，导致部署失败。
解决：始终从 `frontend/` 目录运行 `vercel`。

### 3. NEXT_PUBLIC_ 变量是构建时注入

`NEXT_PUBLIC_` 前缀的环境变量在 `next build` 时替换到代码中，不是运行时读取。
所以添加或修改环境变量后，必须重新部署（`vercel --prod`）才能生效。
