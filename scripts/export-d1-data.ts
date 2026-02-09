#!/usr/bin/env npx tsx
/**
 * Export local D1 data to SQL INSERT statements for production
 *
 * Usage:
 *   npx tsx scripts/export-d1-data.ts > production-data.sql
 *   # Then run:
 *   wrangler d1 execute laguna_hills_hoa --remote --file=production-data.sql
 */

import { execSync } from 'child_process';

// Tables to export (in dependency order - referenced tables first)
const TABLES = [
  'users',
  'households',
  'residents',
  'service_requests',
  'reservations',
  'announcements',
  'events',
  'payments',
  'documents',
  'polls',
  'poll_votes',
  'dues_rates',
  'payment_demands',
  'installment_plans',
  'installment_payments',
  'notifications',
  'pass_fees',
  'vehicle_registrations',
  'household_employees',
];

function executeWrangler(sql: string): string {
  try {
    const result = execSync(
      `wrangler d1 execute laguna_hills_hoa --local --command="${sql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf-8' }
    );
    return result;
  } catch (error: any) {
    // Check if it's just "no results" error
    if (error.stdout) {
      return error.stdout;
    }
    throw error;
  }
}

function exportTable(tableName: string): string {
  console.error(`Exporting ${tableName}...`);

  // Get all data from the table
  const result = executeWrangler(`SELECT * FROM ${tableName}`);

  // Parse the JSON output
  const match = result.match(/\[[\s\S]*\]/);
  if (!match) {
    console.error(`Could not parse results for ${tableName}`);
    return '';
  }

  const data = JSON.parse(match[0]);
  if (!data[0]?.results || data[0].results.length === 0) {
    console.error(`No data in ${tableName}`);
    return `-- No data in ${tableName}\n\n`;
  }

  const rows = data[0].results;
  if (rows.length === 0) {
    return `-- No data in ${tableName}\n\n`;
  }

  // Get column names from first row
  const columns = Object.keys(rows[0]);

  // Generate INSERT statements
  let sql = `-- Data for ${tableName}\n`;

  for (const row of rows) {
    const values = columns.map(col => {
      const val = row[col];
      if (val === null) return 'NULL';
      if (typeof val === 'number') return val;
      if (typeof val === 'boolean') return val ? '1' : '0';
      // Escape single quotes and wrap in quotes
      return `'${String(val).replace(/'/g, "''")}'`;
    }).join(', ');

    sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values});\n`;
  }

  sql += '\n';
  return sql;
}

function main() {
  console.log(`-- D1 Data Export for Production`);
  console.log(`-- Generated: ${new Date().toISOString()}`);
  console.log(`-- Run this with: wrangler d1 execute laguna_hills_hoa --remote --file=production-data.sql`);
  console.log('');
  console.log(`BEGIN TRANSACTION;`);
  console.log('');

  for (const table of TABLES) {
    try {
      console.log(exportTable(table));
    } catch (error: any) {
      console.error(`Error exporting ${table}:`, error.message);
    }
  }

  console.log(`COMMIT;`);
  console.error('\nExport complete!');
}

main();
