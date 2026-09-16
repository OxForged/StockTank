# 架构决策文档

> 日期：2026-03-01
> 状态：已确定

## 背景

Your Podcast 是一个每日中文科技播客自动生成项目。核心流程：RSS 抓取 → Gemini 筛选 → Podcastfy 生成对话脚本 → GLM TTS 合成 → MP3 输出 → Web 播放。

开发者当前在英国，需要选择合适的云平台和架构方案。

---

## 云平台对比

### 候选平台

| 维度 | CloudBase (腾讯云) | Railway | Fly.io | Zeabur | Vercel | Supabase |
|------|-------------------|---------|--------|--------|--------|----------|
| **定位** | BaaS 全家桶 | PaaS 容器平台 | 边缘 VM 平台 | PaaS 容器平台 | 前端 + Serverless | BaaS (数据库为核心) |
| **CLI 工具** | `tcb` 完善 | `railway` 简洁 | `flyctl` 强大 | `npx zeabur` 基础 | `vercel` 流畅 | `supabase` 完善 |
| **部署命令** | `tcb deploy` | `railway up` | `flyctl deploy` | Git 推送 / CLI | `vercel` | Git 推送 |
| **Python 支持** | 云函数（有超时限制） | 原生容器（无限制） | 原生容器（无限制） | 原生容器 | Serverless（超时 10-300s） | Edge Functions (Deno) |
| **数据库** | 内置文档型 DB | 一键 PostgreSQL/Redis | 需自行挂载 | 一键 PostgreSQL/Redis | 无（需外接） | 内置 PostgreSQL |
| **文件存储** | 内置云存储 | 需外接（S3/R2） | 需外接 | 需外接 | Blob Storage | 内置 Storage |
| **长任务支持** | 云函数有超时限制 | 容器常驻，无限制 | 容器常驻，无限制 | 容器常驻 | 超时 10-300s | 不适合 |
| **英国延迟** | 200-350ms | 20-50ms | 10-30ms | 50-100ms | 10-20ms | 20-50ms |
| **免费额度** | 3000 资源点/月 | 试用 $5 + 之后 $1/月 | 无（新用户） | 静态站免费 | Hobby 免费 | 免费计划 |
| **月费预估** | ¥79/年（个人版） | ~$5-15/月 | ~$5-10/月 | ~$5-10/月 | 免费-$20/月 | 免费-$25/月 |
| **国内访问** | 快 | 慢 | 慢 | 较快 | 慢 | 慢 |
| **中文文档** | 完善 | 无 | 无 | 有 | 无 | 无 |

### 针对播客项目的关键需求匹配

| 需求 | CloudBase | Railway | Fly.io | Zeabur | Vercel | Supabase |
|------|-----------|---------|--------|--------|--------|----------|
| 跑 FastAPI 后端 | 云函数（有超时） | 原生支持 | 原生支持 | 原生支持 | Serverless（受限） | 不适合 |
| 几分钟的生成任务 | **受限** | 无问题 | 无问题 | 无问题 | **受限** | **不适合** |
| 存储 MP3 文件 | 内置存储 | 需接 R2 | 需接 R2 | 需接 R2 | Blob Storage | 内置 Storage |
| 英国开发体验 | 延迟高 | 低延迟 | 最低延迟 | 一般 | 低延迟 | 低延迟 |
| CLI 易用性 | 好 | **最好** | 好 | 一般 | 好 | 好 |

---

## 架构方案对比

### 方案 A：Next.js + FastAPI（最终选择）

```
frontend/ (Next.js → Vercel)  ←→  backend/ (FastAPI → Railway)
```

- 优点：前后端分离，前端交互能力强，Next.js 生态丰富，Vercel 部署零配置
- 缺点：两个服务需分别部署
- 适合：需要良好用户体验的播客播放器，后续易扩展

### 方案 B：纯 FastAPI + Jinja2

```
app/ (FastAPI + Jinja2 模板)
```

- 优点：单服务部署，简单高效
- 缺点：前端交互能力有限，播放器体验一般，后续扩展需重写前端

### 方案 C：纯静态站 + GitHub Actions

```
GitHub Actions 生成 → 静态 JSON + MP3 → 静态托管
```

- 优点：零运维，完全免费
- 缺点：无法手动触发生成，扩展性差

---

## 最终决策

### 选择：Next.js (Vercel) + FastAPI (Railway) + Cloudflare R2

### 选择理由

**1. Railway 作为后端平台**

- **长任务无限制**：播客生成流程需要几分钟（RSS + Gemini + TTS + ffmpeg），Railway 容器常驻运行，无超时限制。CloudBase 云函数和 Vercel Serverless 都有超时问题，这是硬伤。
- **英国延迟低**：20-50ms vs CloudBase 的 200-350ms。开发调试体验更好。
- **CLI 体验最好**：`railway up` 一条命令部署，自动识别 Python 项目，体验最接近 CloudBase 的 `tcb deploy`。
- **性价比高**：Hobby 计划 $5/月含 $5 免费额度，基本零成本。

**2. Next.js + Vercel 作为前端**

- **播放器体验好**：React 组件化开发，播放器交互流畅，支持 SPA 无刷新切换。
- **Vercel 零配置部署**：`vercel` 一条命令，Next.js 原生支持，全球 CDN。
- **SSR/SSG 支持**：往期列表可用 SSG 预生成，首屏加载快，SEO 友好。
- **后续扩展性强**：加用户系统、自定义 RSS 等功能时，Next.js 生态成熟，不需要重写。
- **免费**：Vercel Hobby 计划完全免费。

**3. Cloudflare R2 作为存储**

- 免费 10GB 存储（够存数百期播客）
- 出站流量完全免费（这是关键，MP3 文件传输量大）
- 全球 CDN，英国和国内访问都快
- S3 兼容 API，代码迁移容易

**4. Cloudflare D1 作为数据库**

- SQLite 兼容语法，零运维，托管在 Cloudflare 边缘
- 与 R2 同在 Cloudflare 生态，统一管理访问权限
- 播客元信息数据量小，D1 完全够用
- 后端通过 Cloudflare D1 REST API 访问（`https://api.cloudflare.com/client/v4/accounts/{id}/d1/database/{id}/query`）
- 已完成从 SQLite/SQLAlchemy 迁移到 D1 REST API（issue #42）
- 后端使用 `app/services/d1.py`（D1Client）+ `app/d1_database.py`（查询层）访问 D1
- 初始化表结构：`python init_d1.py`

### 排除理由

| 平台 | 排除原因 |
|------|---------|
| **CloudBase** | 云函数超时限制不适合长任务；英国延迟 200-350ms 太高 |
| **Fly.io** | 新用户无免费额度；配置比 Railway 复杂 |
| **Vercel** | Serverless 超时限制（最长 300s）不适合播客生成任务 |
| **Supabase** | 定位是 BaaS，不适合跑计算密集型后端任务 |
| **Zeabur** | CLI 工具不够成熟；欧洲节点覆盖一般 |

---

## 最终架构

```
┌─ 定时触发 ──────────────────────────────────────────────────┐
│  GitHub Actions (cron daily) → generate_all.py                │
└─────────────────────┬──────────────────────────────────────-┘
                      ▼
┌─ Railway (欧洲节点) ───────────────────────────────────────-┐
│  FastAPI                                                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────┐   │
│  │ RSS 抓取  │→│ Gemini   │→│ Podcastfy  │→│ GLM TTS  │   │
│  │feedparser │  │ 筛选8-10 │  │ 对话脚本   │  │ 逐句合成  │   │
│  └──────────┘  └──────────┘  └───────────┘  └────┬─────┘   │
│                                                    │         │
│  ┌──────────────┐                ┌────────────────┘         │
│  │ Cloudflare D1│← 存元信息       ▼                          │
│  │ (REST API)   │             ffmpeg 合并 MP3                │
│  └──────────────┘                │                          │
│                                  ▼                          │
│                           上传 MP3 到 R2                     │
└──────────────────────────────────────────────────────────---┘
                      ▼
┌─ Cloudflare R2 (全球 CDN) ─────────────────────────────────┐
│  /episodes/2026-03-01.mp3                                    │
│  免费 10GB 存储 + 免费出站流量                                 │
└─────────────────────┬──────────────────────────────────────-┘
                      ▼
┌─ Vercel (Next.js 前端) ───────────────────────────────────-┐
│  - 播客播放器组件                                             │
│  - 往期列表（SSG 预生成）                                     │
│  - 调用 FastAPI REST API                                     │
│  - MP3 链接指向 R2 CDN                                       │
└────────────────────────────────────────────────────────────-┘
```

## 技术栈总结

| 层 | 选型 | 说明 |
|----|------|------|
| 云平台 | Railway + Vercel | 后端 Railway，前端 Vercel |
| 前端 | Next.js (Vercel) | 播客播放器 & 往期浏览，全球 CDN |
| 后端 | FastAPI (Railway) | REST API + 播客生成服务 |
| RSS | feedparser | 成熟稳定的 RSS 解析库 |
| AI 筛选 | Google Gemini | 从全部文章挑 8-10 篇最有价值的 |
| 脚本生成 | Podcastfy（备选 Gemini prompt） | 生成双主持人对话脚本 |
| TTS | Inworld TTS（默认）/ Google Gemini TTS（备选） | 双声线 Alex + Jordan，支持切换 |
| 音频处理 | ffmpeg (pydub) | 拼接语音片段为 MP3 |
| 文件存储 | Cloudflare R2 | 免费 10GB，全球 CDN，S3 兼容 |
| 数据库 | Cloudflare D1 | SQLite 兼容，托管在 Cloudflare 边缘，与 R2 同生态 |
| 定时任务 | GitHub Actions cron (`generate_all.py`) | Free 2000 min/month, per-user generation |

## 费用预估

| 项目 | 月费 |
|------|------|
| Railway (Hobby) | $5（含 $5 免费额度，基本免费） |
| Cloudflare R2 | $0（10GB 内免费，出站免费） |
| Gemini API | $0（免费额度够 MVP） |
| GLM TTS API | ~¥10-30（按调用量） |
| GitHub Actions | $0（免费 2000 分钟/月） |
| **合计** | **~¥10-30/月** |
