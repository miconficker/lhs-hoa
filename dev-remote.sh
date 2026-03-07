#!/bin/bash
# Start both frontend and backend servers for Laguna Hills HOA system
# Uses Cloudflare Pages with Functions (REMOTE D1 database)
# Use this when you need to persist data across machines or share with team

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================${NC}"
echo -e "${BLUE}  Laguna Hills HOA - Dev Server${NC}"
echo -e "${BLUE}  (REMOTE D1 Database)${NC}"
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
    echo -e "${BLUE}Starting Cloudflare Pages with Functions (REMOTE D1)...${NC}"
    npm run build > /dev/null 2>&1
    npx wrangler pages dev dist --port 8788 --d1=DB=f7542e2f-7602-41d9-87a5-e2670dc1853e > /tmp/pages-remote.log 2>&1 &
    PAGES_PID=$!

    # Wait for Pages to be ready
    echo -e "${YELLOW}Waiting for Pages Functions to start...${NC}"
    for i in {1..20}; do
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
echo -e "${BLUE}Database:${NC}  Remote D1 (laguna_hills_hoa)"
echo ""
echo -e "${YELLOW}⚠️  WARNING: Using remote database - changes affect everyone!${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
echo ""

# Keep script running and show logs
echo -e "${BLUE}Showing recent logs...${NC}"
echo -e "${YELLOW}(Full logs: tail -f /tmp/pages-remote.log)${NC}"
echo ""
echo -e "${GREEN}Ready for development with remote database!${NC}"
echo ""

# Monitor logs
tail -f /tmp/pages-remote.log 2>/dev/null | grep -E "Ready|ERROR|WARN|Remote|started|GET|POST" --line-buffered
