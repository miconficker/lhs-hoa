#!/bin/bash
# Start both frontend and backend servers for Laguna Hills HOA system
# Uses Cloudflare Pages with Functions (unified deployment)

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
DB_CHECK=$(curl -s http://localhost:8788/api/health 2>/dev/null)
if [ -z "$DB_CHECK" ]; then
    echo -e "${YELLOW}Starting Pages Functions and running database setup...${NC}"
    npm run build > /dev/null 2>&1
    npx wrangler pages dev dist --local --port 8788 > /tmp/pages.log 2>&1 &
    PAGES_PID=$!

    # Wait for Pages Functions to start
    for i in {1..10}; do
        if curl -s http://localhost:8788/api/health > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    # Run migrations
    echo -e "${YELLOW}Running database migrations...${NC}"
    npx wrangler d1 execute laguna_hills_hoa --file=./migrations/0001_schema.sql --local >/dev/null 2>&1
    echo ""
else
    echo -e "${BLUE}Pages Functions already running on port 8788${NC}"
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}Stopping servers...${NC}"

    # Kill Pages dev server
    pkill -f "wrangler pages dev" 2>/dev/null

    echo -e "${GREEN}Servers stopped.${NC}"
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Check if Pages Functions is already running
if curl -s http://localhost:8788/api/health > /dev/null 2>&1; then
    echo -e "${YELLOW}Pages Functions already running on port 8788${NC}"
else
    echo -e "${BLUE}Starting Cloudflare Pages with Functions...${NC}"
    npm run build > /dev/null 2>&1
    npx wrangler pages dev dist --local --port 8788 > /tmp/pages.log 2>&1 &
    PAGES_PID=$!

    # Wait for Pages to be ready
    echo -e "${YELLOW}Waiting for Pages Functions to start...${NC}"
    for i in {1..15}; do
        if curl -s http://localhost:8788/api/health > /dev/null 2>&1; then
            echo -e "${GREEN}Pages Functions is ready!${NC}"
            break
        fi
        sleep 1
        echo -n "."
    done
    echo ""
fi

echo -e "${GREEN}=================================${NC}"
echo -e "${GREEN}  Pages Functions is running!${NC}"
echo -e "${GREEN}=================================${NC}"
echo ""
echo -e "${BLUE}App URL:${NC}   http://localhost:8788"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Keep script running and show logs
echo -e "${BLUE}Showing recent logs...${NC}"
echo -e "${YELLOW}(Full logs: tail -f /tmp/pages.log)${NC}"
echo ""
echo -e "${GREEN}Ready for development!${NC}"
echo ""

# Monitor logs
tail -f /tmp/pages.log 2>/dev/null | grep -E "Ready|ERROR|WARN|Local|started" --line-buffered
