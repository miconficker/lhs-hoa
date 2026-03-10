#!/bin/bash
# ================================================================
# Remote Production Backup Script
# Creates a complete backup of PRODUCTION D1 database
# USE THIS FOR PRODUCTION BACKUP
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
echo -e "${BLUE}  PRODUCTION DATABASE BACKUP${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Database: ${DB_NAME}"
echo "Environment: PRODUCTION"
echo "Backup file: ${BACKUP_FILE}"
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Warning prompt
echo -e "${RED}⚠️  WARNING: This will backup the PRODUCTION database${NC}"
echo -e "${YELLOW}Are you sure you want to proceed? (type 'yes' to continue):${NC}"
read -r confirmation
if [ "$confirmation" != "yes" ]; then
    echo -e "${RED}Backup cancelled${NC}"
    exit 1
fi

# Create backup directory
mkdir -p ${BACKUP_DIR}

# Step 1: Export PRODUCTION database
echo -e "\n${GREEN}Step 1: Exporting PRODUCTION D1 database...${NC}"
echo -e "${YELLOW}This may take several minutes for large databases...${NC}"

npx wrangler d1 export ${DB_NAME} --output=${BACKUP_FILE}

if [ $? -eq 0 ]; then
    BACKUP_SIZE=$(du -h ${BACKUP_FILE} | cut -f1)
    echo -e "${GREEN}✓ Export successful${NC}"
    echo "  Size: ${BACKUP_SIZE}"
    echo "  File: ${BACKUP_FILE}"
else
    echo -e "${RED}✗ Export failed${NC}"
    exit 1
fi

# Step 2: Get table counts from PRODUCTION
echo -e "\n${GREEN}Step 2: Recording PRODUCTION table counts...${NC}"

cat > ${VERIFICATION_FILE} << EOF
PRODUCTION Database Backup Verification
Timestamp: ${TIMESTAMP}
Backup File: ${BACKUP_FILE}
Environment: PRODUCTION

=== Table Counts ===
EOF

echo "Querying PRODUCTION database..."
npx wrangler d1 execute ${DB_NAME} --command="SELECT 'lot_members' as table_name, COUNT(*) as count FROM lot_members" | tee -a ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --command="SELECT 'households' as table_name, COUNT(*) as count FROM households" | tee -a ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --command="SELECT 'residents' as table_name, COUNT(*) as count FROM residents" | tee -a ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --command="SELECT 'users' as table_name, COUNT(*) as count FROM users" | tee -a ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --command="SELECT 'service_requests' as table_name, COUNT(*) as count FROM service_requests" | tee -a ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --command="SELECT 'reservations' as table_name, COUNT(*) as count FROM reservations" | tee -a ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --command="SELECT 'payments' as table_name, COUNT(*) as count FROM payments" | tee -a ${VERIFICATION_FILE}
npx wrangler d1 execute ${DB_NAME} --command="SELECT 'poll_votes' as table_name, COUNT(*) as count FROM poll_votes" | tee -a ${VERIFICATION_FILE}

# Step 3: Critical data verification
echo -e "\n${GREEN}Step 3: Verifying critical data...${NC}"

echo "" >> ${VERIFICATION_FILE}
echo "=== Critical Data Verification ===" >> ${VERIFICATION_FILE}

# Verify lot_members data integrity
echo -e "  Checking lot_members integrity..."
npx wrangler d1 execute ${DB_NAME} --command="
SELECT
  'Primary owners with correct flags' as check,
  COUNT(*) as count
FROM lot_members
WHERE member_type = 'primary_owner' AND can_vote = 1 AND verified = 1
" | tee -a ${VERIFICATION_FILE}

# Verify no community lots migrated
npx wrangler d1 execute ${DB_NAME} --command="
SELECT
  'Community lots in lot_members (should be 0)' as check,
  COUNT(*) as count
FROM lot_members lm
JOIN households h ON lm.household_id = h.id
WHERE h.lot_type IN ('community', 'utility', 'open_space')
" | tee -a ${VERIFICATION_FILE}

# Verify legacy data exists (for rollback safety)
npx wrangler d1 execute ${DB_NAME} --command="
SELECT
  'Households with owner_id (legacy)' as check,
  COUNT(*) as count
FROM households
WHERE owner_id IS NOT NULL
" | tee -a ${VERIFICATION_FILE}

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
echo ""
echo -e "${GREEN}✓ PRODUCTION backup complete${NC}"
echo -e "${GREEN}✓ Ready to proceed with Phase 3 when approved${NC}"
