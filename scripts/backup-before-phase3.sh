#!/bin/bash
# ================================================================
# Pre-Phase 3 Backup Script
# Creates a complete backup of D1 database before Phase 3 cleanup
# ================================================================

set -e  # Exit on any error

# Configuration
BACKUP_DIR="backups"
DB_NAME="laguna_hills_hoa"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/pre-phase3-${TIMESTAMP}.sql"
VERIFICATION_FILE="${BACKUP_DIR}/pre-phase3-verification-${TIMESTAMP}.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}  PRE-PHASE 3 BACKUP${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "Database: ${DB_NAME}"
echo "Backup file: ${BACKUP_FILE}"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Step 1: Export database
echo -e "\n${GREEN}Step 1: Exporting D1 database...${NC}"
npx wrangler d1 export ${DB_NAME} --output=${BACKUP_FILE}

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Export successful${NC}"
    ls -lh ${BACKUP_FILE}
else
    echo -e "${RED}✗ Export failed${NC}"
    exit 1
fi

# Step 2: Get table counts
echo -e "\n${GREEN}Step 2: Recording table counts...${NC}"

cat > ${VERIFICATION_FILE} << EOF
Pre-Phase 3 Backup Verification
Timestamp: ${TIMESTAMP}
Backup File: ${BACKUP_FILE}

=== Table Counts ===
EOF

# Get counts (requires manual SQL queries via wrangler)
echo "Run verification script to get detailed table counts:"
echo "  npx wrangler d1 execute ${DB_NAME} --local --file=scripts/verify-phase3-ready.sql | tee -a ${VERIFICATION_FILE}"

# Step 3: Verification queries
echo -e "\n${GREEN}Step 3: Running verification queries...${NC}"

echo "" >> ${VERIFICATION_FILE}
echo "=== Verification Queries ===" >> ${VERIFICATION_FILE}

npx wrangler d1 execute ${DB_NAME} --local --command="SELECT 'lot_members' as table_name, COUNT(*) as count FROM lot_members" >> ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --local --command="SELECT 'households' as table_name, COUNT(*) as count FROM households" >> ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --local --command="SELECT 'residents' as table_name, COUNT(*) as count FROM residents" >> ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --local --command="SELECT 'users' as table_name, COUNT(*) as count FROM users" >> ${VERIFICATION_FILE}

# Step 4: Summary
echo -e "\n${GREEN}=== Backup Complete ===${NC}"
echo ""
echo "Files created:"
echo "  - ${BACKUP_FILE}"
echo "  - ${VERIFICATION_FILE}"
echo ""
echo -e "${YELLOW}Next steps before Phase 3:${NC}"
echo "  1. Review backup file size (should be substantial)"
echo "  2. Run: npx wrangler d1 execute ${DB_NAME} --local --file=scripts/verify-phase3-ready.sql"
echo "  3. Complete all items in scripts/PHASE3_SAFETY_CHECKLIST.md"
echo ""
echo -e "${GREEN}✓ Ready for Phase 3 when all checklist items are complete${NC}"
