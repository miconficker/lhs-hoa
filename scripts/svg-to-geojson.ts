#!/usr/bin/env node
/**
 * SVG to GeoJSON Converter for Laguna Hills HOA Map
 *
 * This script converts the SVG subdivision map into GeoJSON format
 * for use with Leaflet's ImageOverlay. The pixel coordinates are preserved
 * as-is (no GPS conversion) since the map will be overlaid on the image.
 *
 * The SVG uses groups with specific IDs:
 * - "lots": Individual lot polygons (ids like "B01-L01")
 * - "blocks": Block boundary polygons
 * - "perimeter": Perimeter boundary
 * - "streets": Street lines (if present)
 * - "common-areas": Common area polygons (if present)
 *
 * Input: LAGUNA-HILLS-MAP-v2.svg
 * Output: public/data/{lots,blocks,perimeter,streets,common-areas}.geojson
 *
 * Options:
 *   --mapping <path>   Path to lot-mapping.json file to apply lot numbers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Lot mapping types
interface LotMapping {
  path_id: string;
  lot_number: string;
  block_number?: string;
  annotated_at?: string;
}

interface LotMappingFile {
  version: string;
  created_at: string;
  mappings: LotMapping[];
}

// GeoJSON type definitions
interface GeoJSONGeometry {
  type: string;
  coordinates: any;
}

interface GeoJSONFeature {
  type: 'Feature';
  id?: string;
  geometry: GeoJSONGeometry;
  properties: Record<string, any>;
}

interface LotFeatureProperties {
  path_id: string;
  lot_number: string | null;
  block_number: string | null;
  area_sqm: number | null;
  status: string;
  owner_user_id: string;
  lot_size_sqm: number | null;
}

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SVG dimensions from viewBox
const SVG_WIDTH = 2304;
const SVG_HEIGHT = 3456;

// Flip Y-axis to convert from SVG (Y=0 at top) to Leaflet L.CRS.Simple (Y=0 at bottom)
const SCALE_X = 1;
const SCALE_Y = -1;  // Flip Y axis
const TRANSLATE_Y = SVG_HEIGHT;  // Shift to align after flip

interface Point {
  x: number;
  y: number;
}

interface PathData {
  id: string;
  points: Point[];
  isClosed: boolean;
  rawPath: string;
  hasTransform: boolean;  // True if path has its own transform attribute
  subpaths?: Point[][];  // Multiple subpaths for polygons with holes/islands
}

/**
 * Parse SVG path data to extract coordinates
 * Supports both absolute (M, L, H, V, C, Z) and relative (m, l, h, v, c, z) commands
 * Also supports repeated implicit commands (e.g., "L 10 10 20 20")
 * Returns an array of subpaths (for polygons with holes/islands)
 */
function parsePathData(d: string): Point[][] {
  const subpaths: Point[][] = [];
  let currentPath: Point[] = [];
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  let startSet = false;
  let pathStarted = false;

  // Tokenize: split into commands and numbers
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const cmd = token;
    const isRelative = cmd === cmd.toLowerCase();

    i++; // Move to next token

    switch (cmd.toLowerCase()) {
      case 'm': // moveto - starts a new subpath
        {
          // If we already have a path started, save it and start a new one
          if (pathStarted && currentPath.length > 0) {
            subpaths.push(currentPath);
            currentPath = [];
            startSet = false;
            // Reset coordinates for absolute moveto, keep for relative
            if (cmd === 'M') {
              currentX = 0;
              currentY = 0;
            }
          }

          pathStarted = true;
          while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
            const dx = parseFloat(tokens[i++]);
            const dy = parseFloat(tokens[i++]);

            if (isRelative) {
              currentX += dx;
              currentY += dy;
            } else {
              currentX = dx;
              currentY = dy;
            }

            currentPath.push({ x: currentX, y: currentY });

            if (!startSet) {
              startX = currentX;
              startY = currentY;
              startSet = true;
            }
          }
        }
        break;

      case 'l': // lineto
        {
          while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
            const dx = parseFloat(tokens[i++]);
            const dy = parseFloat(tokens[i++]);

            if (isRelative) {
              currentX += dx;
              currentY += dy;
            } else {
              currentX = dx;
              currentY = dy;
            }

            currentPath.push({ x: currentX, y: currentY });
          }
        }
        break;

      case 'h': // horizontal lineto
        {
          while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
            const dx = parseFloat(tokens[i++]);
            if (isRelative) {
              currentX += dx;
            } else {
              currentX = dx;
            }
            currentPath.push({ x: currentX, y: currentY });
          }
        }
        break;

      case 'v': // vertical lineto
        {
          while (i < tokens.length && !isNaN(parseFloat(tokens[i]))) {
            const dy = parseFloat(tokens[i++]);
            if (isRelative) {
              currentY += dy;
            } else {
              currentY = dy;
            }
            currentPath.push({ x: currentX, y: currentY });
          }
        }
        break;

      case 'c': // curveto (cubic bezier) - we'll just add the end point
        {
          while (i + 5 < tokens.length && !isNaN(parseFloat(tokens[i]))) {
            const c1x = parseFloat(tokens[i++]);
            const c1y = parseFloat(tokens[i++]);
            const c2x = parseFloat(tokens[i++]);
            const c2y = parseFloat(tokens[i++]);
            const dx = parseFloat(tokens[i++]);
            const dy = parseFloat(tokens[i++]);

            if (isRelative) {
              currentX += dx;
              currentY += dy;
            } else {
              currentX = dx;
              currentY = dy;
            }
            currentPath.push({ x: currentX, y: currentY });
          }
        }
        break;

      case 's': // smooth curveto
      case 'q': // quadratic bezier
      case 't': // smooth quadratic bezier
      case 'a': // elliptical arc
        {
          const numArgs = cmd.toLowerCase() === 'a' ? 7 : cmd.toLowerCase() === 's' || cmd.toLowerCase() === 'q' ? 4 : 2;
          while (i + numArgs - 1 < tokens.length && !isNaN(parseFloat(tokens[i]))) {
            for (let j = 0; j < numArgs - 2; j++) {
              i++;
            }
            const dx = parseFloat(tokens[i++]);
            const dy = parseFloat(tokens[i++]);

            if (isRelative) {
              currentX += dx;
              currentY += dy;
            } else {
              currentX = dx;
              currentY = dy;
            }
            currentPath.push({ x: currentX, y: currentY });
          }
        }
        break;

      case 'z': // close path
        {
          if (startSet && currentPath.length > 0) {
            currentPath.push({ x: startX, y: startY });
            currentX = startX;
            currentY = startY;
            // Don't reset startSet - the next subpath will use 'm' to set new start
          }
        }
        break;
    }
  }

  // Add the last subpath if it exists
  if (currentPath.length > 0) {
    subpaths.push(currentPath);
  }

  // If no subpaths were created, return empty array
  if (subpaths.length === 0) {
    return [[]];
  }

  return subpaths;
}

/**
 * Apply the SVG transform matrix to convert coordinates to pixel space
 * The transform is: matrix(1.3333333, 0, 0, -1.3333333, 0, 3456)
 * This maps the SVG coordinate space to the pixel coordinate space
 *
 * For paths that already have a transform attribute in the SVG, we only
 * apply the scale (1.3333) without the Y-flip, since the SVG transform
 * already handles the flip.
 */
function applyTransform(x: number, y: number, hasTransform: boolean = false): Point {
  if (hasTransform) {
    // Path already has transform in SVG - only apply scale, no Y-flip
    return {
      x: x * Math.abs(SCALE_X),
      y: y * Math.abs(SCALE_X),  // Just use the scale (1.3333), no flip
    };
  }
  return {
    x: x * SCALE_X,
    y: y * SCALE_Y + TRANSLATE_Y,
  };
}

/**
 * Calculate polygon area using the Shoelace formula
 */
function calculateArea(points: Point[]): number {
  let area = 0;
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }

  return Math.abs(area) / 2;
}

/**
 * Check if a path forms a closed polygon
 * A path is closed if it starts and ends at the same point (within tolerance)
 * Now accepts multiple subpaths (Point[][]) and checks if the first subpath is closed
 */
function isClosedPolygon(subpaths: Point[][]): boolean {
  if (subpaths.length === 0 || subpaths[0].length < 4) return false;

  const points = subpaths[0];
  const first = points[0];
  const last = points[points.length - 1];

  const tolerance = 0.1;
  return (
    Math.abs(first.x - last.x) < tolerance &&
    Math.abs(first.y - last.y) < tolerance
  );
}

/**
 * Extract all path elements from the SVG
 * If groupId is specified, only extract paths within that group
 */
function extractPaths(svgContent: string, groupId?: string): PathData[] {
  const paths: PathData[] = [];

  // If groupId specified, only look within that group
  let searchContent = svgContent;
  if (groupId) {
    // Match <g id="groupId">...</g>
    const groupRegex = new RegExp(`<g[^>]*\\sid=["']${groupId}["'][^>]*>([\\s\\S]*?)</g>`, 'i');
    const groupMatch = groupRegex.exec(svgContent);
    if (!groupMatch) {
      console.warn(`Group ${groupId} not found in SVG`);
      return [];
    }
    searchContent = groupMatch[1];
  }

  // Regex to match complete path elements and extract id and d attributes
  // This captures the full path element to check for transform attribute
  const pathRegex = /<path[^>]*\sid=["']([^"']+)["'][^>]*\sd=["']([^"']+)["'][^>]*\/>/gi;
  let match;

  while ((match = pathRegex.exec(searchContent)) !== null) {
    const fullElement = match[0];
    const id = match[1];
    const d = match[2];

    // Check if path has a transform attribute (these are pre-transformed in SVG)
    const hasTransform = /transform\s*=/i.test(fullElement);

    try {
      const subpaths = parsePathData(d);

      // Check if path is closed (check first subpath)
      const closed = isClosedPolygon(subpaths);

      // Flatten subpaths into points for backward compatibility
      const points = subpaths.flat();

      paths.push({
        id,
        points,
        isClosed: closed,
        rawPath: d,
        hasTransform,
        subpaths: subpaths.length > 1 ? subpaths : undefined,
      });
    } catch (e) {
      console.warn(`Failed to parse path ${id}: ${(e as Error).message}`);
    }
  }

  // Also try the reverse order (d before id) for compatibility
  const pathRegexReverse = /<path[^>]*\sd=["']([^"']+)["'][^>]*\sid=["']([^"']+)["'][^>]*\/>/gi;
  while ((match = pathRegexReverse.exec(searchContent)) !== null) {
    const fullElement = match[0];
    const d = match[1];
    const id = match[2];

    // Skip if we already got this path (avoid duplicates)
    if (paths.find(p => p.id === id)) continue;

    // Check if path has a transform attribute
    const hasTransform = /transform\s*=/i.test(fullElement);

    try {
      const subpaths = parsePathData(d);

      // Check if path is closed (check first subpath)
      const closed = isClosedPolygon(subpaths);

      // Flatten subpaths into points for backward compatibility
      const points = subpaths.flat();

      paths.push({
        id,
        points,
        isClosed: closed,
        rawPath: d,
        hasTransform,
        subpaths: subpaths.length > 1 ? subpaths : undefined,
      });
    } catch (e) {
      console.warn(`Failed to parse path ${id}: ${(e as Error).message}`);
    }
  }

  return paths;
}

/**
 * Calculate the total length of a path
 */
function calculatePathLength(points: Point[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/**
 * Convert PathData to GeoJSON Feature
 */
function pathToGeoJSONFeature(
  path: PathData,
  type: 'Polygon' | 'LineString',
  lotMappings?: Map<string, LotMapping>,
): GeoJSONFeature {
  let geometry: GeoJSONGeometry;

  // Check if this path has multiple subpaths (e.g., block with island)
  const hasMultipleSubpaths = path.subpaths && path.subpaths.length > 1;

  if (type === 'Polygon') {
    if (hasMultipleSubpaths) {
      // Create MultiPolygon for paths with multiple subpaths (e.g., block with island)
      const polygons = path.subpaths.map(subpath => {
        const transformedSubpath = subpath.map((p) => applyTransform(p.x, p.y, path.hasTransform));
        return [transformedSubpath.map((p) => [p.x, p.y] as [number, number])];
      });
      geometry = {
        type: 'MultiPolygon',
        coordinates: polygons,
      };
    } else {
      // Single polygon
      const transformedPoints = path.points.map((p) => applyTransform(p.x, p.y, path.hasTransform));
      const coords = transformedPoints.map((p) => [p.x, p.y] as [number, number]);
      geometry = {
        type: 'Polygon',
        coordinates: [coords],
      };
    }
  } else {
    // For linestrings, coordinates are [ [x,y], [x,y], ... ]
    const transformedPoints = path.points.map((p) => applyTransform(p.x, p.y, path.hasTransform));
    const coords = transformedPoints.map((p) => [p.x, p.y] as [number, number]);
    geometry = {
      type: 'LineString',
      coordinates: coords,
    };
  }

  // Calculate area from first subpath (for filtering)
  const transformedFirstPath = (path.subpaths?.[0] || path.points).map((p) => applyTransform(p.x, p.y, path.hasTransform));
  const area = type === 'Polygon' ? calculateArea(transformedFirstPath) : null;

  // Parse lot and block numbers from path ID
  // Lots: "B01-L01", Blocks: "Block 02"
  let lotNumber: string | null = null;
  let blockNumber: string | null = null;
  let featureId = path.id;

  const idMatch = path.id.match(/^B(\d+)-L(\d+)(?:-.*)?$/i);
  if (idMatch) {
    blockNumber = idMatch[1].padStart(2, '0');
    lotNumber = idMatch[2].padStart(2, '0');
  } else {
    // Check if this is a block: "Block 02" -> block_number = "02", id = "block-02"
    const blockMatch = path.id.match(/^Block\s*(\d+)$/i);
    if (blockMatch) {
      blockNumber = blockMatch[1].padStart(2, '0');
      featureId = `block-${blockNumber}`;
    }
  }

  // Apply mapping if available and this is a lot
  if (lotMappings && lotMappings.has(path.id)) {
    const mapping = lotMappings.get(path.id);
    if (mapping) {
      lotNumber = mapping.lot_number;
      blockNumber = mapping.block_number || blockNumber;
    }
  }

  // Add placeholder fields for new database columns
  const properties: LotFeatureProperties = {
    path_id: path.id,
    lot_number: lotNumber,
    block_number: blockNumber,
    area_sqm: area,
    status: 'vacant_lot',  // Default status
    owner_user_id: 'developer-owner',  // Default owner
    lot_size_sqm: null,  // No size data yet
  };

  return {
    type: 'Feature',
    id: featureId,
    geometry,
    properties,
  };
}

/**
 * Create GeoJSON FeatureCollection
 */
function createFeatureCollection(
  features: GeoJSONFeature[],
): GeoJSONFeatureCollection {
  return {
    type: 'FeatureCollection',
    features,
  };
}

/**
 * Load lot mappings from a JSON file
 */
function loadLotMappings(mappingPath: string): Map<string, LotMapping> {
  if (!fs.existsSync(mappingPath)) {
    console.warn(`Mapping file not found: ${mappingPath}`);
    return new Map();
  }

  try {
    const content = fs.readFileSync(mappingPath, 'utf-8');
    const mappingFile = JSON.parse(content) as LotMappingFile;

    if (!mappingFile.mappings || !Array.isArray(mappingFile.mappings)) {
      console.warn('Invalid mapping file format');
      return new Map();
    }

    // Create a map for quick lookup by path_id
    const mappingMap = new Map<string, LotMapping>();
    for (const mapping of mappingFile.mappings) {
      mappingMap.set(mapping.path_id, mapping);
    }

    console.log(`✓ Loaded ${mappingMap.size} lot mappings from ${mappingPath}`);
    return mappingMap;
  } catch (err) {
    console.warn(`Error loading mapping file: ${(err as Error).message}`);
    return new Map();
  }
}

/**
 * Main conversion function
 */
function convertSvgToGeoJSON(mappingPath?: string): void {
  console.log('Starting SVG to GeoJSON conversion...');
  console.log('='.repeat(50));

  // Read SVG file
  const svgPath = path.join(__dirname, '../LAGUNA-HILLS-MAP-v2.svg');

  if (!fs.existsSync(svgPath)) {
    console.error(`SVG file not found: ${svgPath}`);
    process.exit(1);
  }

  const svgContent = fs.readFileSync(svgPath, 'utf-8');
  console.log(`✓ Loaded SVG file (${svgContent.length} bytes)`);

  // Load lot mappings if provided
  const lotMappings = mappingPath ? loadLotMappings(mappingPath) : new Map();

  // Extract from specific groups
  const lots = extractPaths(svgContent, 'lots')
    .filter(p => {
      // Use first subpath for area calculation if available
      const pathToCheck = p.subpaths?.[0] || p.points;
      const transformedPath = pathToCheck.map(pt => applyTransform(pt.x, pt.y, p.hasTransform));
      return p.isClosed && calculateArea(transformedPath) > 50;
    });
  const blocks = extractPaths(svgContent, 'blocks')
    .filter(p => p.isClosed);
  const perimeter = extractPaths(svgContent, 'perimeter')
    .filter(p => p.isClosed);

  console.log(`✓ Extracted ${lots.length} lots, ${blocks.length} blocks, ${perimeter.length} perimeter paths`);

  // Convert to GeoJSON with lot mappings applied to lots
  const lotsGeoJSON = createFeatureCollection(lots.map(p => pathToGeoJSONFeature(p, 'Polygon', lotMappings)));
  const blocksGeoJSON = createFeatureCollection(blocks.map(p => pathToGeoJSONFeature(p, 'Polygon')));
  const perimeterGeoJSON = createFeatureCollection(perimeter.map(p => pathToGeoJSONFeature(p, 'Polygon')));

  // Ensure output directory exists
  const outputDir = path.join(__dirname, '../public/data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write all files
  fs.writeFileSync(path.join(outputDir, 'lots.geojson'), JSON.stringify(lotsGeoJSON, null, 2));
  if (blocks.length > 0) {
    fs.writeFileSync(path.join(outputDir, 'blocks.geojson'), JSON.stringify(blocksGeoJSON, null, 2));
  }
  if (perimeter.length > 0) {
    fs.writeFileSync(path.join(outputDir, 'perimeter.geojson'), JSON.stringify(perimeterGeoJSON, null, 2));
  }

  console.log('\nConversion complete!');
  console.log('='.repeat(50));
  console.log(`Output files:`);
  console.log(`  - ${path.join(outputDir, 'lots.geojson')} (${lotsGeoJSON.features.length} features)`);
  if (blocks.length > 0) {
    console.log(`  - ${path.join(outputDir, 'blocks.geojson')} (${blocksGeoJSON.features.length} features)`);
  }
  if (perimeter.length > 0) {
    console.log(`  - ${path.join(outputDir, 'perimeter.geojson')} (${perimeterGeoJSON.features.length} features)`);
  }

  // Summary statistics
  console.log('\n--- Summary ---');
  console.log(`SVG dimensions: ${SVG_WIDTH}x${SVG_HEIGHT}`);
  console.log(`Lots: ${lotsGeoJSON.features.length}`);
  if (blocks.length > 0) {
    console.log(`Blocks: ${blocksGeoJSON.features.length}`);
  }
  if (perimeter.length > 0) {
    console.log(`Perimeter: ${perimeterGeoJSON.features.length}`);
  }

  // Calculate total lot area
  const totalArea = lotsGeoJSON.features.reduce((sum, f) => {
    return sum + ((f.properties.area_sqm as number) || 0);
  }, 0);
  console.log(`Total lot area: ${totalArea.toFixed(2)} square pixels`);
  console.log(`Average lot area: ${(totalArea / lotsGeoJSON.features.length || 0).toFixed(2)} square pixels`);
}

// Run the conversion
// Parse CLI arguments for --mapping option
const args = process.argv.slice(2);
let mappingPath: string | undefined;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--mapping' && i + 1 < args.length) {
    mappingPath = args[i + 1];
    break;
  }
}

// Resolve mapping path relative to script directory if provided
if (mappingPath) {
  if (!path.isAbsolute(mappingPath)) {
    // If path doesn't exist as-is, try resolving relative to script directory
    if (!fs.existsSync(mappingPath)) {
      const resolvedPath = path.join(__dirname, mappingPath);
      if (fs.existsSync(resolvedPath)) {
        mappingPath = resolvedPath;
      }
    }
  }
  console.log(`Using mapping file: ${mappingPath}`);
}

convertSvgToGeoJSON(mappingPath);
