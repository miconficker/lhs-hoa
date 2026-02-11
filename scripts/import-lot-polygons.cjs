#!/usr/bin/env node

/**
 * Import lot polygons from lots.geojson to database
 * Usage: node scripts/import-lot-polygons.js [--local|--remote]
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ENV = process.argv.includes('--remote') ? 'remote' : 'local';
const DB_NAME = 'laguna_hills_hoa';

// Read GeoJSON file
const geojsonPath = path.join(__dirname, '../public/data/lots.geojson');
const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));

console.log(`📊 Found ${geojson.features.length} features in GeoJSON`);
console.log(`🌍 Environment: ${ENV}`);
console.log(`📦 Database: ${DB_NAME}`);
console.log('');

let updated = 0;
let skipped = 0;
const errors = [];

for (const feature of geojson.features) {
  try {
    const lotId = feature.id || feature.properties?.path_id;
    if (!lotId) {
      skipped++;
      continue;
    }

    // Extract polygon coordinates
    if (feature.geometry?.type === 'Polygon' && feature.geometry?.coordinates) {
      const polygon = feature.geometry.coordinates[0]; // Outer ring
      const polygonJson = JSON.stringify(polygon);

      // Escape single quotes for SQL
      const escapedPolygon = polygonJson.replace(/'/g, "''");

      // Update lot_polygon in database
      const sql = `UPDATE households SET lot_polygon = '${escapedPolygon}' WHERE id = '${lotId}'`;

      try {
        const result = execSync(
          `npx wrangler d1 execute ${DB_NAME} --${ENV} --command "${sql}"`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
        );

        // Check if any rows were affected
        if (result.includes('"changes":1') || result.includes('"changes": 1')) {
          updated++;
        } else {
          skipped++;
        }
      } catch (err) {
        // Lot might not exist in database
        errors.push(`${lotId}: ${err.message.split('\n')[0]}`);
        skipped++;
      }
    } else {
      errors.push(`${lotId}: no polygon geometry found`);
      skipped++;
    }

    // Progress indicator every 50 lots
    if ((updated + skipped) % 50 === 0) {
      process.stdout.write(`\r✅ Processed ${updated + skipped}/${geojson.features.length} lots...`);
    }
  } catch (error) {
    errors.push(`${feature.id}: ${error.message}`);
    skipped++;
  }
}

console.log(`\r${' '.repeat(60)}\r`); // Clear progress line
console.log('');
console.log('═══════════════════════════════════════════════════════════');
console.log('                    IMPORT COMPLETE                         ');
console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Updated:   ${updated} lots`);
console.log(`⏭️  Skipped:   ${skipped} lots`);
console.log(`❌ Errors:    ${errors.length} lots`);
if (errors.length > 0 && errors.length <= 10) {
  console.log('');
  console.log('Error details:');
  errors.forEach(e => console.log(`  - ${e}`));
} else if (errors.length > 10) {
  console.log('');
  console.log('First 10 errors:');
  errors.slice(0, 10).forEach(e => console.log(`  - ${e}`));
  console.log(`  ... and ${errors.length - 10} more`);
}
console.log('═══════════════════════════════════════════════════════════');
