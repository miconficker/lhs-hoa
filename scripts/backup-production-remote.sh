#!/bin/bash
# ================================================================
# Remote Production Backup Script (Fixed)
# Creates a complete backup of PRODUCTION D1 database
# ================================================================

set -e  # Exit on any error

# Configuration
BACKUP_DIR="backups/production"
DB_NAME="laguna_hills_hoa"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/production-backup-${TIMESTAMP}.sql"
VERIFICATION_FILE="${BACKUP_DIR}/production-verification-${TIMESTAMP}.txt"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  PRODUCTION DATABASE BACKUP (REMOTE)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Database: ${DB_NAME}"
echo "Environment: PRODUCTION (REMOTE)"
echo "Backup file: ${BACKUP_FILE}"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Warning prompt
echo -e "${RED}⚠️  WARNING: This will backup the PRODUCTION database (REMOTE)${NC}"
echo -e "${YELLOW}Are you sure you want to proceed? (type 'yes' to continue):${NC}"
read -r confirmation
if [ "$confirmation" != "yes" ]; then
    echo -e "${RED}Backup cancelled${NC}"
    exit 1
fi

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Step 1: Export PRODUCTION database (REMOTE)
echo -e "\n${GREEN}Step 1: Exporting PRODUCTION D1 database (REMOTE)...${NC}"
echo -e "${YELLOW}This may take several minutes for large databases...${NC}"

npx wrangler d1 export ${DB_NAME} --remote --output=${BACKUP_FILE}

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h ${BACKUP_FILE} | cut -f1)
    echo -e "${GREEN}✓ Export successful${NC}"
    echo "  Size: ${BACKUP_SIZE}"
    echo "  File: ${BACKUP_FILE}"
else
    echo -e "${RED}✗ Export failed${NC}"
    exit 1
fi

# Step 2: Get table counts from PRODUCTION (REMOTE)
echo -e "\n${GREEN}Step 2: Recording PRODUCTION table counts...${NC}"

cat > ${VERIFICATION_FILE} << EOF
PRODUCTION Database Backup Verification
Timestamp: ${TIMESTAMP}
Backup File: ${BACKUP_FILE}
Environment: PRODUCTION (REMOTE)

=== Table Counts ===
EOF

echo "Querying PRODUCTION database (REMOTE)..."
npx wrangler d1 execute ${DB_NAME} --remote --command="SELECT 'lot_members' as table_name, COUNT(*) as count FROM lot_members" 2>&1 | grep -E "table_name|count" | tee -a ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --remote --command="SELECT 'households' as table_name, COUNT(*) as count FROM households" 2>&1 | grep -E "table_name|count" | tee -a ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --remote --command="SELECT 'residents' as table_name, COUNT(*) as count FROM residents" 2>&1 | grep -E "table_name|count" | tee -a ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --remote --command="SELECT 'users' as table_name, COUNT(*) as count FROM users" 2>&1 | grep -E "table_name|count" | tee -a ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --remote --command="SELECT 'service_requests' as table_name, COUNT(*) as count FROM service_requests" 2>&1 | grep -E "table_name|count" | tee -a ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --remote --command="SELECT 'reservations' as table_name, COUNT(*) as count FROM reservations" 2>&1 | grep -E "table_name|count" | tee -a ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --remote --command="SELECT 'payments' as table_name, COUNT(*) as count FROM payments" 2>&1 | grep -E "table_name|count" | tee -a ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --remote --command="SELECT 'poll_votes' as table_name, COUNT(*) as count FROM poll_votes" 2>&1 | grep -E "table_name|count" | tee -a ${VERIFICATION_FILE}

# Step 3: Critical data verification
echo -e "\n${GREEN}Step 3: Verifying critical data...${NC}"

echo "" >> ${VERIFICATION_FILE}
echo "=== Critical Data Verification ===" >> ${VERIFICATION_FILE}

# Check if lot_members table exists
echo -e "  Checking if lot_members table exists..."
LOT_MEMBERS_CHECK=$(npx wrangler d1 execute ${DB_NAME} --remote --command="SELECT COUNT(*) FROM lot_members" 2>&1 | grep -c "lot_members does not exist" || true)

if [ "$LOT_MEMBERS_CHECK" -eq 0 ]; then
    echo -e "  ${GREEN}✓ lot_members table exists${NC}"
else
    echo -e "  ${YELLOW}⚠ lot_members table NOT found - Phase 1 may not be deployed to production${NC}"
    echo "" >> ${VERIFICATION_FILE}
    echo "WARNING: lot_members table does not exist in production" >> ${VERIFICATION_FILE}
fi

# Get lot_members count if table exists
npx wrangler d1 execute ${DB_NAME} --remote --command="SELECT COUNT(*) as count FROM lot_members" 2>&1 | grep "count" | tee -a ${VERIFICATION_FILE} || true

# Verify legacy data exists (for rollback safety)
npx wrangler d1 execute ${DB_NAME} --remote --command="SELECT COUNT(*) as count FROM households WHERE owner_id IS NOT NULL" 2>&1 | grep "count" | tee -a ${VERIFICATION_FILE} || true

# Step 4: Create checksum
echo -e "\n${GREEN}Step 4: Creating backup checksum...${NC}"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
sha256sum ${BACKUP_FILE} > ${CHECKSUM_FILE}
echo -e "${GREEN}✓ Checksum created: ${CHECKSUM_FILE}${NC}"
cat ${CHECKSUM_FILE}

# Step 5: Summary
echo -e "\n${GREEN}=== PRODUCTION BACKUP COMPLETE ===${NC}"
echo ""
echo "Files created:"
echo "  - ${BACKUP_FILE}"
echo "  - ${VERIFICATION_FILE}"
echo "  - ${CHECKSUM_FILE}"
echo ""
echo -e "${BLUE}Backup Location:${NC}"
echo "  Local: $(pwd)/${BACKUP_FILE}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT:${NC}"
echo "  1. Store backup in secure location (cloud storage or external drive)"
echo "  2. Keep checksum file with backup for integrity verification"
echo "  3. Save verification report for pre-Phase 3 reference"
echo "  4. DO NOT proceed to Phase 3 if lot_members table is missing"
echo ""
echo -e "${GREEN}✓ PRODUCTION backup complete${NC}"
echo -e "${GREEN}✓ Ready to proceed with Phase 3 when approved${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Review ${VERIFICATION_FILE}"
echo "  2. Ensure lot_members table exists in production"
echo "  3. Run: npx wrangler d1 execute ${DB_NAME} --remote --file=scripts/verify-phase3-ready.sql"
echo "  4. Complete all items in scripts/PHASE3_SAFETY_CHECKLIST.md"
