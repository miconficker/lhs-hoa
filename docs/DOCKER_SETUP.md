# Docker Setup Guide

## Architecture

This project uses Cloudflare Workers (serverless) + Vite (frontend). Docker is used ONLY for the frontend containerization. The backend (Workers, D1, R2) runs via Wrangler.

## Prerequisites

- Docker Desktop installed
- Node.js 20+ installed (for Wrangler)
- Wrangler CLI: `npm install -g wrangler`

## Development Setup

### Frontend (Docker)
```bash
docker-compose up
```
Access at: http://localhost:5173

### Backend (Wrangler)
```bash
npm run dev:worker
```
Access at: http://localhost:8787

### Database (Local D1)
```bash
wrangler d1 execute laguna_hills_hoa --local --file=./migrations/0001_schema.sql
```

## Production Build

```bash
docker build -t lhs-hoa-frontend .
docker run -p 80:80 lhs-hoa-frontend
```

## Troubleshooting

### Port already in use
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Container not building
```bash
# Clear Docker cache
docker system prune -a
```

### Volume mounting issues
```bash
# Rebuild with no cache
docker-compose build --no-cache
```

## Known Limitations

1. **Cloudflare Workers:** Cannot run in Docker (requires Wrangler)
2. **D1 Database:** Local-only (use `wrangler d1 --local`)
3. **R2 Storage:** No local emulation (use mock or cloud instance)

## CI/CD Integration

Docker is used in GitHub Actions for production builds. See `.github/workflows/deploy-production.yml`.
