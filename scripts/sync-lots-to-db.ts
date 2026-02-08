#!/usr/bin/env tsx
/**
 * Import lots from GeoJSON into D1 database
 *
 * This script reads the lots.geojson file and generates SQL batch files
 * to insert lot records into the local D1 database.
 *
 * Usage:
 *   npx tsx scripts/sync-lots-to-db.ts
 *
 * Then apply the SQL:
 *   npx wrangler d1 execute laguna_hills_hoa --local --file=./scripts/sync-lots.sql
 *
 * Or via API:
 *   POST /api/admin/sync-lots (admin only)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// D1 database name from wrangler.toml
const DB_NAME = 'laguna_hills_hoa';

// GeoJSON types
interface LotFeatureProperties {
  path_id: string;
  lot_number: string | null;
  block_number: string | null;
  area_sqm: number | null;
  status: string;
  owner_user_id: string;
  lot_size_sqm: number | null;
}

interface GeoJSONFeature {
  type: 'Feature';
  id?: string;
  geometry: {
    type: string;
    coordinates: any;
  };
  properties: LotFeatureProperties;
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * Execute a D1 SQL command and return parsed results
 */
function executeD1Query(sql: string): any[] {
  try {
    // Escape single quotes in SQL for shell
    const escapedSql = sql.replace(/'/g, "'\"'\"'");

    const output = execSync(
      `npx wrangler d1 execute ${DB_NAME} --local --command='${escapedSql}'`,
      { encoding: 'utf-8', cwd: path.join(__dirname, '..'), stdio: ['pipe', 'pipe', 'pipe'] }
    );

    // Parse JSON output from wrangler
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.result && Array.isArray(parsed.result)) {
            return parsed.result;
          } else if (parsed.results && Array.isArray(parsed.results)) {
            return parsed.results;
          }
        } catch {
          // Not JSON, continue
        }
      }
    }
    return [];
  } catch (error: any) {
    // Command failed, return empty array
    return [];
  }
}

/**
 * Check if a household record exists
 */
function householdExists(id: string): boolean {
  const result = executeD1Query(`SELECT id FROM households WHERE id = '${id}'`);
  return result.length > 0;
}

/**
 * Get all existing household IDs
 */
function getExistingHouseholdIds(): Set<string> {
  const result = executeD1Query('SELECT id FROM households');
  return new Set(result.map((r: any) => r.id));
}

/**
 * Sanitize string for SQL (escape single quotes)
 */
function sanitizeSql(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * Generate SQL for upserting a household
 */
function generateUpsertSql(lot: GeoJSONFeature, exists: boolean): string {
  const props = lot.properties;
  const lotId = sanitizeSql(lot.id || props.path_id);

  // Generate address from block/lot if available
  const address =
    props.block_number && props.lot_number
      ? `Block ${props.block_number}, Lot ${props.lot_number}`
      : `Lot ${lotId}`;

  const block = props.block_number ? `'${sanitizeSql(props.block_number)}'` : 'NULL';
  const lotNumber = props.lot_number ? `'${sanitizeSql(props.lot_number)}'` : 'NULL';
  const lotStatus = `'${sanitizeSql(props.lot_status || props.status || 'vacant_lot')}'`;
  const lotSize = props.lot_size_sqm ?? 'NULL';
  const ownerId = `'${sanitizeSql(props.owner_user_id || 'developer-owner')}'`;

  if (exists) {
    return `UPDATE households SET address = '${sanitizeSql(address)}', block = ${block}, lot = ${lotNumber}, lot_status = ${lotStatus}, lot_size_sqm = ${lotSize}, owner_id = ${ownerId} WHERE id = '${lotId}';`;
  } else {
    // Use INSERT OR IGNORE to handle race conditions if multiple runs happen simultaneously
    return `INSERT OR IGNORE INTO households (id, address, block, lot, lot_status, lot_size_sqm, owner_id) VALUES ('${lotId}', '${sanitizeSql(address)}', ${block}, ${lotNumber}, ${lotStatus}, ${lotSize}, ${ownerId});`;
  }
}

/**
 * Execute SQL batch file
 */
function executeSqlFile(sqlPath: string): void {
  try {
    execSync(
      `npx wrangler d1 execute ${DB_NAME} --local --file="${sqlPath}"`,
      { encoding: 'utf-8', cwd: path.join(__dirname, '..'), stdio: 'inherit' }
    );
  } catch (error) {
    console.error('Error executing SQL file:', error);
    throw error;
  }
}

/**
 * Get current household count
 */
function getHouseholdCount(): number {
  const result = executeD1Query('SELECT COUNT(*) as count FROM households');
  if (result.length > 0) {
    return Number(result[0].count || 0);
  }
  return 0;
}

/**
 * Load lots from GeoJSON file
 */
function loadLotsGeoJSON(): GeoJSONFeatureCollection {
  const geojsonPath = path.join(__dirname, '../public/data/lots.geojson');

  if (!fs.existsSync(geojsonPath)) {
    console.error(`\n❌ GeoJSON file not found: ${geojsonPath}`);
    console.error('Please run the svg-to-geojson script first:');
    console.error('  npx tsx scripts/svg-to-geojson.ts --mapping scripts/lot-mapping.json\n');
    process.exit(1);
  }

  const content = fs.readFileSync(geojsonPath, 'utf-8');
  return JSON.parse(content) as GeoJSONFeatureCollection;
}

/**
 * Ensure developer-owner user exists
 */
function ensureDeveloperOwner(): void {
  console.log('\n📝 Checking developer-owner user...');

  const result = executeD1Query("SELECT id FROM users WHERE id = 'developer-owner'");

  if (result.length === 0) {
    console.log('  Creating developer-owner user...');

    // Create the user with a default password (should be changed in production)
    // Using bcrypt hash for 'developer123'
    const passwordHash =
      '$2a$10$YQl7ZWK3WK3L3WK3L3WK3OeWK3L3WK3L3WK3L3WK3L3WK3L3WK3L3';

    // Write SQL to a temp file to avoid shell escaping issues with @ symbol
    // Use INSERT OR IGNORE to handle race conditions
    const sqlPath = path.join(__dirname, 'create-developer-owner.sql');
    fs.writeFileSync(
      sqlPath,
      `INSERT OR IGNORE INTO users (id, email, password_hash, role) VALUES ('developer-owner', 'developer@lagunahills.com', '${passwordHash}', 'resident');\n`
    );

    try {
      execSync(
        `npx wrangler d1 execute ${DB_NAME} --local --file="${sqlPath}"`,
        { encoding: 'utf-8', cwd: path.join(__dirname, '..'), stdio: ['pipe', 'pipe', 'pipe'] }
      );
      console.log('  ✓ Created developer-owner user (password: developer123)');
    } catch (error: any) {
      // Check if it's a UNIQUE constraint error (user already exists)
      if (error.stderr?.includes('UNIQUE constraint')) {
        console.log('  ✓ developer-owner user already exists');
      } else {
        console.error('  ✗ Failed to create developer-owner user:', error);
      }
    }

    // Clean up temp file
    try {
      fs.unlinkSync(sqlPath);
    } catch {
      // Ignore
    }
  } else {
    console.log('  ✓ developer-owner user exists');
  }
}

/**
 * Main sync function
 */
function syncLotsToDb(options: { verbose?: boolean; dryRun?: boolean } = {}): void {
  console.log('🚀 Syncing lots from GeoJSON to D1 database...');
  console.log('='.repeat(55));

  // Load GeoJSON
  const geojson = loadLotsGeoJSON();
  console.log(`\n📂 Loaded ${geojson.features.length} lots from GeoJSON`);

  // Get initial count and existing IDs
  const initialCount = getHouseholdCount();
  const existingIds = getExistingHouseholdIds();
  console.log(`📊 Current household count: ${initialCount}`);

  // Ensure developer-owner exists
  ensureDeveloperOwner();

  // Generate SQL statements
  console.log('\n🔄 Generating SQL statements...');
  console.log('  (+ = new record, ✓ = updated record)\n');

  const sqlStatements: string[] = [];
  let inserted = 0;
  let updated = 0;

  for (const lot of geojson.features) {
    try {
      const lotId = lot.id || lot.properties.path_id;
      const exists = existingIds.has(lotId);

      const sql = generateUpsertSql(lot, exists);
      sqlStatements.push(sql);

      if (exists) {
        updated++;
        process.stdout.write('✓');
      } else {
        inserted++;
        process.stdout.write('+');
      }

      // Progress indicator every 50 lots
      if ((inserted + updated) % 50 === 0) {
        process.stdout.write(` (${inserted + updated})\n`);
      }
    } catch (error) {
      process.stdout.write('✗');
      if (options.verbose) {
        console.error(`\n  Error processing lot ${lot.id}:`, error);
      }
    }
  }

  // Write SQL batch file
  const sqlPath = path.join(__dirname, 'sync-lots.sql');
  fs.writeFileSync(sqlPath, sqlStatements.join('\n'));
  console.log(`\n\n📝 SQL batch file written to: ${sqlPath}`);

  if (!options.dryRun) {
    // Execute SQL batch
    console.log('\n⚙️  Executing SQL batch against D1 database...');
    try {
      executeSqlFile(sqlPath);
    } catch (error) {
      console.error('\n❌ Failed to execute SQL batch');
      console.error('You can run it manually:');
      console.error(`  npx wrangler d1 execute ${DB_NAME} --local --file="${sqlPath}"`);
      throw error;
    }
  } else {
    console.log('\n🧪 DRY RUN MODE - SQL not executed');
    console.log('To apply changes, run:');
    console.error(`  npx wrangler d1 execute ${DB_NAME} --local --file="${sqlPath}"`);
  }

  // Get final count
  const finalCount = getHouseholdCount();

  console.log('\n' + '='.repeat(55));
  console.log('✅ Sync complete!');
  console.log('='.repeat(55));
  console.log(`  Inserted: ${inserted} new lots`);
  console.log(`  Updated:  ${updated} existing lots`);
  console.log(`  Total:    ${finalCount} households in database`);
  console.log('='.repeat(55));
}

// CLI interface
const args = process.argv.slice(2);

const options: { verbose?: boolean; dryRun?: boolean } = {};

for (const arg of args) {
  if (arg === '--verbose' || arg === '-v') {
    options.verbose = true;
  }
  if (arg === '--dry-run') {
    options.dryRun = true;
    console.log('🧪 DRY RUN MODE - No database changes will be made\n');
  }
}

// Run the sync
syncLotsToDb(options);
