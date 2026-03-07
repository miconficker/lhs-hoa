# T-029 Docker Configuration - Implementation Guide

**Task:** Docker Configuration for Local Development
**Status:** BLOCKED - Requires Implementation
**Estimated Time:** 1 day (8-10 hours)

---

## Quick Start Templates

Use these templates to implement Docker configuration for this project.

### Template 1: Production Dockerfile (`Dockerfile`)

```dockerfile
# Multi-stage build for production
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build production bundle
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### Template 2: Development Dockerfile (`Dockerfile.dev`)

```dockerfile
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start development server with host binding
CMD ["npm", "run", "dev", "--", "--host"]
```

### Template 3: Docker Compose (`docker-compose.yml`)

```yaml
version: '3.8'

services:
  # Frontend development server
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    volumes:
      - .:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:8787
    command: npm run dev -- --host

  # Note: Cloudflare Workers backend must run via wrangler, not Docker
  # Use: npm run dev:worker (outside of Docker) for local backend development
```

### Template 4: Docker Ignore (`.dockerignore`)

```
node_modules
npm-debug.log
dist
.env
.env.local
.git
.vscode
.wrangler
.worker-next
*.md
docs
.mr-cache
coverage
*.log
```

### Template 5: Nginx Configuration (`nginx.conf`)

```nginx
user nginx;
worker_processes auto;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    server {
        listen 80;
        server_name localhost;
        root /usr/share/nginx/html;
        index index.html;

        # SPA routing - redirect all non-file requests to index.html
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API proxy to Cloudflare Workers (if needed for production)
        location /api/ {
            proxy_pass https://your-worker.workers.dev/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }

        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

---

## Architecture Explanation

### Why Docker is Limited to Frontend

This project uses **Cloudflare Workers**, a serverless platform that does NOT run in Docker containers:

| Component | Platform | Docker Compatible? |
|-----------|----------|-------------------|
| Frontend (Vite + React) | Local/CDN | ✅ YES |
| Backend (Cloudflare Workers) | Cloudflare Edge | ❌ NO (use Wrangler) |
| Database (D1 SQLite) | Cloudflare Infrastructure | ❌ NO (use wrangler d1) |
| Storage (R2) | Cloudflare Infrastructure | ❌ NO (use local R2 emulation) |

### Development Workflow

**Frontend (in Docker):**
```bash
docker-compose up
# Access at http://localhost:5173
```

**Backend (with Wrangler):**
```bash
npm run dev:worker
# Access at http://localhost:8787
```

**Full Stack (separate terminals):**
```bash
# Terminal 1: Frontend
docker-compose up

# Terminal 2: Backend
npm run dev:worker

# Terminal 3: Database
wrangler d1 execute laguna_hills_hoa --local --file=./migrations/0001_schema.sql
```

---

## Implementation Steps

### Step 1: Create Docker Files (1 hour)

```bash
# Create production Dockerfile
cat > Dockerfile << 'EOF'
[Paste Template 1 here]
EOF

# Create development Dockerfile
cat > Dockerfile.dev << 'EOF'
[Paste Template 2 here]
EOF

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
[Paste Template 3 here]
EOF

# Create .dockerignore
cat > .dockerignore << 'EOF'
[Paste Template 4 here]
EOF

# Create nginx.conf
cat > nginx.conf << 'EOF'
[Paste Template 5 here]
EOF
```

### Step 2: Test Docker Build (30 minutes)

```bash
# Test production build
docker build -t lhs-hoa-frontend .
# Expected: Build completes successfully, ~200MB image

# Test development build
docker build -t lhs-hoa-dev -f Dockerfile.dev .
# Expected: Build completes successfully, ~500MB image

# Run development container
docker run -p 5173:5173 -v $(pwd):/app lhs-hoa-dev
# Expected: Vite dev server starts at http://localhost:5173
```

### Step 3: Test Docker Compose (30 minutes)

```bash
# Start development environment
docker-compose up
# Expected: Frontend starts at http://localhost:5173

# Test volume mounting
# Make changes to src/App.tsx
# Expected: Changes reflect immediately (hot reload)
```

### Step 4: Create Documentation (2 hours)

Create `docs/DOCKER_SETUP.md` with:

```markdown
# Docker Setup Guide

## Architecture

This project uses Cloudflare Workers (serverless) + Vite (frontend). Docker is used ONLY for the frontend containerization. The backend (Workers, D1, R2) runs via Wrangler.

## Prerequisites

- Docker Desktop installed
- Node.js 20+ installed (for Wrangler)
- Wrangler CLI: `npm install -g wrangler`

## Development Setup

### Frontend (Docker)
\`\`\`bash
docker-compose up
\`\`\`
Access at: http://localhost:5173

### Backend (Wrangler)
\`\`\`bash
npm run dev:worker
\`\`\`
Access at: http://localhost:8787

### Database (Local D1)
\`\`\`bash
wrangler d1 execute laguna_hills_hoa --local --file=./migrations/0001_schema.sql
\`\`\`

## Production Build

\`\`\`bash
docker build -t lhs-hoa-frontend .
docker run -p 80:80 lhs-hoa-frontend
\`\`\`

## Troubleshooting

### Port already in use
\`\`\`bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
\`\`\`

### Container not building
\`\`\`bash
# Clear Docker cache
docker system prune -a
\`\`\`

### Volume mounting issues
\`\`\`bash
# Rebuild with no cache
docker-compose build --no-cache
\`\`\`

## Known Limitations

1. **Cloudflare Workers:** Cannot run in Docker (requires Wrangler)
2. **D1 Database:** Local-only (use `wrangler d1 --local`)
3. **R2 Storage:** No local emulation (use mock or cloud instance)

## CI/CD Integration

Docker is used in GitHub Actions for production builds. See `.github/workflows/deploy-production.yml`.
```

---

## Verification Checklist

Before marking T-029 as complete, verify:

- [ ] `Dockerfile` exists and is non-empty
- [ ] `Dockerfile.dev` exists and is non-empty
- [ ] `docker-compose.yml` exists and is non-empty
- [ ] `.dockerignore` exists and is non-empty
- [ ] `nginx.conf` exists and is non-empty
- [ ] `docs/DOCKER_SETUP.md` exists and is comprehensive
- [ ] `docker build -t test .` succeeds (production)
- [ ] `docker build -t test -f Dockerfile.dev .` succeeds (dev)
- [ ] `docker-compose up` starts dev server
- [ ] Application accessible at http://localhost:5173
- [ ] Hot reload works when editing files

---

## Common Issues

### Issue: "Cannot connect to backend from container"

**Solution:** Frontend in Docker cannot reach `localhost:8787` on host. Use host networking or environment variable:

```yaml
# docker-compose.yml
services:
  frontend:
    network_mode: host  # Use host network
    # OR
    environment:
      - VITE_API_URL=http://host.docker.internal:8787
```

### Issue: "Volume mounting fails on Windows"

**Solution:** Check Docker Desktop settings, enable file sharing for project drive.

### Issue: "Build is slow"

**Solution:** Use `.dockerignore` to exclude unnecessary files, leverage BuildKit cache.

---

## Next Steps

1. Copy templates above into actual files
2. Customize environment variables as needed
3. Test all commands in Verification Checklist
4. Return to QA with working Docker setup
5. Include screenshot of `docker-compose up` running successfully

---

**Implementation Time Estimate:** 8-10 hours
**Difficulty:** Medium (requires Docker knowledge)
**Dependencies:** None (can proceed independently)
