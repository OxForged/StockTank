# CI/CD 总览

## 部署架构

| 什么 | 放哪 | URL |
|------|------|-----|
| Next.js 前端 | **Vercel** | `https://your-podcast.vercel.app` |
| FastAPI 后端 | **Railway** | `https://your-podcast-production.up.railway.app` |
| MP3 + DB 备份 | **Cloudflare R2** | 后端通过 boto3 上传 |

## 前后端连接

```
Vercel 前端  ──NEXT_PUBLIC_API_URL──→  Railway 后端
             ←──── CORS allow ──────
```

| 方向 | 怎么连 | 在哪配 |
|------|--------|--------|
| 前端 → 后端 | `NEXT_PUBLIC_API_URL` 指向 Railway | Vercel Dashboard 环境变量 |
| 后端 → 前端 | CORS 允许 `your-podcast.vercel.app` | `backend/app/main.py` origins 列表 |

## 自动部署触发

| 事件 | 发生什么 |
|------|---------|
| PR 到 main | CI 检查（lint/build/import）+ Vercel Preview 部署 + Railway Preview 部署 |
| 合并到 main | Vercel Production 部署 + Railway Production 部署 |
| PR 关闭 | Railway Preview 环境自动清理 |

## 环境变量速查

**Vercel（前端）：**

| 变量 | 值 |
|------|-----|
| `NEXT_PUBLIC_API_URL` | `https://your-podcast-production.up.railway.app` |

**Railway（后端）：**

| 变量 | 说明 |
|------|------|
| `FRONTEND_URL` | Vercel 前端 URL（CORS） |
| `GEMINI_API_KEY` | Google Gemini |
| `GLM_API_KEY` | 智谱 TTS |
| `R2_ACCOUNT_ID` | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | R2 Access Key |
| `R2_SECRET_ACCESS_KEY` | R2 Secret Key |
| `R2_BUCKET_NAME` | R2 Bucket 名 |
| `R2_PUBLIC_URL` | R2 公开 URL |

## GitHub Actions Secrets

| Secret | 用途 |
|--------|------|
| `VERCEL_TOKEN` | Vercel 部署 |
| `VERCEL_ORG_ID` | Vercel 组织 |
| `VERCEL_PROJECT_ID` | Vercel 项目 |
| `RAILWAY_TOKEN` | Railway 项目 Token（production 部署） |
| `RAILWAY_SERVICE_ID` | Railway 服务 ID |
| `RAILWAY_API_TOKEN` | Railway 账户 API Token（preview 部署） |
| `RAILWAY_PROJECT_ID` | Railway 项目 ID（preview 部署） |
