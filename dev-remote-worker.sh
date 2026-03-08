#!/bin/bash
# Start both frontend and backend servers for Laguna Hills HOA system
# Uses Cloudflare Worker with REMOTE D1 database

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  Laguna Hills HOA - Dev Server${NC}"
echo -e "${BLUE}  (REMOTE D1 Database via Worker)${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# Check if remote DB is accessible
echo -e "${YELLOW}Checking remote D1 database connection...${NC}"
DB_CHECK=$(npx wrangler d1 execute laguna_hills_hoa --remote --command="SELECT COUNT(*) as count FROM users" 2>/dev/null | grep -oP '(?<=count": )\d+' || echo "")

if [ -z "$DB_CHECK" ]; then
    echo -e "${RED}Failed to connect to remote D1 database${NC}"
    echo -e "${YELLOW}Make sure you're authenticated:${NC} npx wrangler login"
    exit 1
fi

echo -e "${GREEN}Connected! Found $DB_CHECK users in remote database${NC}"
echo ""

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping servers...${NC}"
    pkill -f "wrangler dev" 2>/dev/null
    pkill -f "vite.*--port" 2>/dev/null
    echo -e "${GREEN}Servers stopped.${NC}"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Build the worker
echo -e "${BLUE}Building worker...${NC}"
npx wrangler build --compatibility-date=2024-01-01 > /tmp/worker-build.log 2>&1
if [ $? -ne 0 ]; then
    echo -e "${RED}Worker build failed${NC}"
    cat /tmp/worker-build.log
    exit 1
fi

# Start the worker with remote D1
echo -e "${BLUE}Starting Cloudflare Worker (REMOTE D1)...${NC}"
npx wrangler dev --remote --port 8787 --compatibility-date=2024-01-01 --vars JWT_SECRET=D3g/b9I7bREI8bAlhlh/jXqes4/h90fmwHMc9UMtNPQ= --vars ENVIRONMENT=development --vars ALLOWED_ORIGINS=http://localhost:5173,http://localhost:8788 > /tmp/worker-remote.log 2>&1 &
WORKER_PID=$!

# Wait for worker to be ready
echo -e "${YELLOW}Waiting for Worker to start...${NC}"
for i in {1..30}; do
    if curl -s http://localhost:8787/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}Worker is ready!${NC}"
        break
    fi
    sleep 1
    echo -n "."
done
echo ""

# Start vite frontend
echo -e "${BLUE}Starting Vite frontend...${NC}"
npm run dev > /tmp/vite-remote.log 2>&1 &
VITE_PID=$!

sleep 3

echo -e "${GREEN}=================================${NC}"
echo -e "${GREEN}  Both servers are running!${NC}"
echo -e "${GREEN}=================================${NC}"
echo ""
echo -e "${BLUE}Frontend:${NC}  http://localhost:5173"
echo -e "${BLUE}Worker API:${NC} http://localhost:8787"
echo -e "${BLUE}Database:${NC}  Remote D1 (laguna_hills_hoa)"
echo ""
echo -e "${YELLOW}⚠️  Using remote database - changes affect everyone!${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Keep script running
echo -e "${BLUE}Worker logs (Ctrl+C to stop):${NC}"
tail -f /tmp/worker-remote.log 2>/dev/null | grep -E "Ready|ERROR|WARN|GET|POST" --line-buffered
