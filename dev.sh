#!/bin/bash
# Start both frontend and backend servers for Laguna Hills HOA system

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  Laguna Hills HOA - Dev Server${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""

# Check if this is the first run (need to run migrations?)
DB_CHECK=$(curl -s http://localhost:8787/api/health 2>/dev/null)
if [ -z "$DB_CHECK" ]; then
    echo -e "${YELLOW}Starting worker and running database setup...${NC}"
    npx wrangler dev --config wrangler.worker.jsonc > /tmp/worker.log 2>&1 &
    WORKER_PID=$!

    # Wait for worker
    for i in {1..10}; do
        if curl -s http://localhost:8787/api/health > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    # Run migrations
    echo -e "${YELLOW}Running database migrations...${NC}"
    npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0001_schema.sql --local >/dev/null 2>&1
    echo ""
else
    echo -e "${BLUE}Worker already running on port 8787${NC}"
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping servers...${NC}"

    # Kill frontend dev server
    pkill -f "vite.*5173" 2>/dev/null

    # Kill backend worker
    pkill -f "wrangler dev" 2>/dev/null

    echo -e "${GREEN}Servers stopped.${NC}"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Check if worker is already running
if curl -s http://localhost:8787/api/health > /dev/null 2>&1; then
    echo -e "${YELLOW}Worker already running on port 8787${NC}"
else
    echo -e "${BLUE}Starting Cloudflare Workers backend...${NC}"
    npx wrangler dev --config wrangler.worker.jsonc > /tmp/worker.log 2>&1 &
    WORKER_PID=$!

    # Wait for worker to be ready
    echo -e "${YELLOW}Waiting for worker to start...${NC}"
    for i in {1..15}; do
        if curl -s http://localhost:8787/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}Worker is ready!${NC}"
            break
        fi
        sleep 1
        echo -n "."
    done
    echo ""
fi

# Check if frontend is already running
if curl -s http://localhost:5173 > /dev/null 2>&1; then
    echo -e "${YELLOW}Frontend already running on port 5173${NC}"
else
    echo -e "${BLUE}Starting Vite frontend...${NC}"
    npm run dev > /tmp/frontend.log 2>&1 &
    FRONTEND_PID=$!

    # Wait for frontend to be ready
    echo -e "${YELLOW}Waiting for frontend to start...${NC}"
    for i in {1..10}; do
        if curl -s http://localhost:5173 > /dev/null 2>&1; then
            echo -e "${GREEN}Frontend is ready!${NC}"
            break
        fi
        sleep 1
        echo -n "."
    done
    echo ""
fi

echo -e "${GREEN}=================================${NC}"
echo -e "${GREEN}  Both servers are running!${NC}"
echo -e "${GREEN}=================================${NC}"
echo ""
echo -e "${BLUE}Frontend:${NC}  http://localhost:5173"
echo -e "${BLUE}Backend:${NC}   http://localhost:8787"
echo ""
echo -e "${YELLOW}Login Credentials:${NC}"
echo -e "  ${NC}Admin:    ${BLUE}admin@lagunahills.com${NC} / ${GREEN}admin123${NC}"
echo -e "  ${NC}Resident: ${BLUE}resident@test.com${NC}  / ${GREEN}resident123${NC}"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"
echo ""

# Keep script running and show logs if desired
echo -e "${BLUE}Showing recent logs...${NC}"
echo -e "${YELLOW}(Frontend logs: tail -f /tmp/frontend.log | Worker logs: tail -f /tmp/worker.log)${NC}"
echo ""
echo -e "${GREEN}Ready for development!${NC}"
echo ""

# Monitor both logs
tail -f /tmp/worker.log /tmp/frontend.log 2>/dev/null | grep -E "Ready|ERROR|WARN|Local server|started" --line-buffered
