#!/usr/bin/env node
/**
 * SVG to GeoJSON Converter for Laguna Hills HOA Map
 *
 * This script converts the SVG subdivision map into GeoJSON format
 * for use with Leaflet's ImageOverlay. The pixel coordinates are preserved
 * as-is (no GPS conversion) since the map will be overlaid on the image.
 *
 * Input: LAGUNA-HILLS-MAP.svg
 * Output: public/data/{lots,blocks,streets}.geojson
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

interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SVG dimensions from viewBox
const SVG_WIDTH = 2304;
const SVG_HEIGHT = 3456;

// No transformation needed - the PNG was exported from the SVG,
// so coordinates match exactly. Using L.CRS.Simple in Leaflet
// with the same bounds preserves this alignment.
const SCALE_X = 1;
const SCALE_Y = 1;
const TRANSLATE_Y = 0;

interface Point {
  x: number;
  y: number;
}

interface PathData {
  id: string;
  points: Point[];
  isClosed: boolean;
  rawPath: string;
}

/**
 * Parse SVG path data to extract coordinates
 * Supports both absolute (M, L, H, V, C, Z) and relative (m, l, h, v, c, z) commands
 * Also supports repeated implicit commands (e.g., "L 10 10 20 20")
 */
function parsePathData(d: string): Point[] {
  const points: Point[] = [];
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  let startSet = false;

  // Tokenize: split into commands and numbers
  // This regex matches commands (M, m, L, l, etc.) and numbers (including negative and decimals)
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) || [];

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    const cmd = token;
    const isRelative = cmd === cmd.toLowerCase();

    i++; // Move to next token

    switch (cmd.toLowerCase()) {
      case 'm': // moveto
      case 'l': // lineto
        {
          const isFirst = cmd.toLowerCase() === 'm' && !startSet;
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

            points.push({ x: currentX, y: currentY });

            if (isFirst && !startSet) {
              startX = currentX;
              startY = currentY;
              startSet = true;
            }
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
            points.push({ x: currentX, y: currentY });
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
            points.push({ x: currentX, y: currentY });
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
            points.push({ x: currentX, y: currentY });
          }
        }
        break;

      case 's': // smooth curveto
      case 'q': // quadratic bezier
      case 't': // smooth quadratic bezier
      case 'a': // elliptical arc
        {
          // For these, skip to the end point (usually last pair of numbers)
          // This is a simplification - we should properly parse these
          const numArgs = cmd.toLowerCase() === 'a' ? 7 : cmd.toLowerCase() === 's' || cmd.toLowerCase() === 'q' ? 4 : 2;
          while (i + numArgs - 1 < tokens.length && !isNaN(parseFloat(tokens[i]))) {
            for (let j = 0; j < numArgs - 2; j++) {
              i++; // Skip control points
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
            points.push({ x: currentX, y: currentY });
          }
        }
        break;

      case 'z': // close path
        {
          if (startSet) {
            points.push({ x: startX, y: startY });
            currentX = startX;
            currentY = startY;
          }
        }
        break;
    }
  }

  return points;
}

/**
 * Apply the SVG transform matrix to convert coordinates to pixel space
 * The transform is: matrix(1.3333333, 0, 0, -1.3333333, 0, 3456)
 * This maps the SVG coordinate space to the pixel coordinate space
 */
function applyTransform(x: number, y: number): Point {
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
 */
function isClosedPolygon(points: Point[]): boolean {
  if (points.length < 4) return false; // Need at least 4 points (3 unique + closing)

  const first = points[0];
  const last = points[points.length - 1];

  // Check if first and last points are the same
  const tolerance = 0.1;
  return (
    Math.abs(first.x - last.x) < tolerance &&
    Math.abs(first.y - last.y) < tolerance
  );
}

/**
 * Extract all path elements from the SVG
 */
function extractPaths(svgContent: string): PathData[] {
  const paths: PathData[] = [];

  // Regex to match path elements
  const pathRegex = /<path[^>]*\sid="([^"]+)"[^>]*\sd="([^"]+)"/g;
  let match;

  while ((match = pathRegex.exec(svgContent)) !== null) {
    const id = match[1];
    const d = match[2];

    try {
      const points = parsePathData(d);

      // Check if path is closed
      const closed = isClosedPolygon(points);

      paths.push({
        id,
        points,
        isClosed: closed,
        rawPath: d,
      });
    } catch (e) {
      console.warn(`Failed to parse path ${id}: ${(e as Error).message}`);
    }
  }

  return paths;
}

/**
 * Classify paths into lots (closed polygons), streets (open polylines), and blocks
 */
function classifyPaths(paths: PathData[]): {
  lots: PathData[];
  streets: PathData[];
  blocks: PathData[];
} {
  const lots: PathData[] = [];
  const streets: PathData[] = [];

  for (const path of paths) {
    // Skip very small paths (likely artifacts)
    if (path.points.length < 3) continue;

    // Transform points for area calculation
    const transformedPoints = path.points.map((p) => applyTransform(p.x, p.y));

    // Check for closed polygons
    if (path.isClosed) {
      const area = calculateArea(transformedPoints);

      // Filter by area - lot polygons should have reasonable area
      // Adjust this threshold based on actual lot sizes
      if (area > 500) {
        lots.push({
          ...path,
          points: transformedPoints, // Store transformed points
        });
      }
    } else if (path.points.length >= 2) {
      // Open paths are streets or boundaries
      // Filter out very short paths (likely artifacts)
      const length = calculatePathLength(transformedPoints);
      if (length > 10) {
        streets.push(path);
      }
    }
  }

  // Generate blocks by clustering lots based on proximity
  const blocks = generateBlocksFromLots(lots);

  return { lots, streets, blocks };
}

/**
 * Generate blocks by clustering lots based on proximity
 */
function generateBlocksFromLots(lots: PathData[]): PathData[] {
  if (lots.length === 0) return [];

  // Calculate centroids for each lot
  const lotCentroids: Array<{ lot: PathData; centroid: Point }> = lots.map((lot) => ({
    lot,
    centroid: calculateCentroid(lot.points),
  }));

  // Group lots into blocks using simple distance-based clustering
  const BLOCK_DISTANCE_THRESHOLD = 150; // Distance threshold for grouping lots into blocks
  const visited = new Set<number>();
  const blocks: PathData[] = [];
  let blockNumber = 1;

  for (let i = 0; i < lotCentroids.length; i++) {
    if (visited.has(i)) continue;

    // Start a new block with this lot
    const blockLots: PathData[] = [lotCentroids[i].lot];
    visited.add(i);

    // Find all lots within threshold distance (BFS clustering)
    const queue = [i];
    while (queue.length > 0) {
      const currentIdx = queue.shift()!;
      const currentCentroid = lotCentroids[currentIdx].centroid;

      for (let j = 0; j < lotCentroids.length; j++) {
        if (visited.has(j)) continue;

        const distance = Math.sqrt(
          Math.pow(lotCentroids[j].centroid.x - currentCentroid.x, 2) +
            Math.pow(lotCentroids[j].centroid.y - currentCentroid.y, 2),
        );

        if (distance <= BLOCK_DISTANCE_THRESHOLD) {
          visited.add(j);
          blockLots.push(lotCentroids[j].lot);
          queue.push(j);
        }
      }
    }

    // Generate block polygon from the lots in this block
    if (blockLots.length >= 2) {
      const blockPolygon = createBlockPolygon(blockLots, blockNumber);
      if (blockPolygon) {
        blocks.push(blockPolygon);
        blockNumber++;
      }
    }
  }

  return blocks;
}

/**
 * Calculate the centroid (center point) of a polygon
 */
function calculateCentroid(points: Point[]): Point {
  let cx = 0;
  let cy = 0;
  const A = calculateArea(points);
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = points[i].x * points[j].y - points[j].x * points[i].y;
    cx += (points[i].x + points[j].x) * cross;
    cy += (points[i].y + points[j].y) * cross;
  }

  cx /= 6 * A;
  cy /= 6 * A;

  return { x: cx, y: cy };
}

/**
 * Create a block polygon from a group of lots
 * This creates a convex hull around all the lots in the block
 */
function createBlockPolygon(lots: PathData[], blockNumber: number): PathData | null {
  if (lots.length === 0) return null;

  // Collect all points from all lots
  const allPoints: Point[] = [];
  for (const lot of lots) {
    allPoints.push(...lot.points);
  }

  // Compute convex hull to get the block boundary
  const hullPoints = convexHull(allPoints);

  if (hullPoints.length < 3) return null;

  return {
    id: `block-${blockNumber}`,
    points: hullPoints,
    isClosed: true,
    rawPath: '',
  };
}

/**
 * Compute convex hull using Graham scan algorithm
 */
function convexHull(points: Point[]): Point[] {
  if (points.length < 3) return points;

  // Remove duplicate points
  const unique = Array.from(
    new Map(points.map((p) => [`${p.x},${p.y}`, p])).values(),
  );

  if (unique.length < 3) return unique;

  // Sort points by x-coordinate (then by y)
  const sorted = [...unique].sort((a, b) => a.x - b.x || a.y - b.y);

  // Build lower hull
  const lower: Point[] = [];
  for (const p of sorted) {
    while (
      lower.length >= 2 &&
      crossProduct(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    ) {
      lower.pop();
    }
    lower.push(p);
  }

  // Build upper hull
  const upper: Point[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (
      upper.length >= 2 &&
      crossProduct(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    ) {
      upper.pop();
    }
    upper.push(p);
  }

  // Concatenate hulls (remove last point of each to avoid duplication)
  lower.pop();
  upper.pop();

  return [...lower, ...upper];
}

/**
 * Cross product for orientation testing
 */
function crossProduct(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
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
  const transformedPoints = path.points.map((p) => applyTransform(p.x, p.y));

  let geometry: GeoJSONGeometry;

  if (type === 'Polygon') {
    // For polygons, coordinates are [ [[x,y], [x,y], ...] ]
    const coords = transformedPoints.map((p) => [p.x, p.y] as [number, number]);
    geometry = {
      type: 'Polygon',
      coordinates: [coords],
    };
  } else {
    // For linestrings, coordinates are [ [x,y], [x,y], ... ]
    const coords = transformedPoints.map((p) => [p.x, p.y] as [number, number]);
    geometry = {
      type: 'LineString',
      coordinates: coords,
    };
  }

  const area = type === 'Polygon' ? calculateArea(transformedPoints) : null;

  // Apply mapping if available and this is a lot
  let lotNumber: string | null = null;
  let blockNumber: string | null = null;

  if (type === 'Polygon' && lotMappings) {
    const mapping = lotMappings.get(path.id);
    if (mapping) {
      lotNumber = mapping.lot_number;
      blockNumber = mapping.block_number || null;
    }
  }

  return {
    type: 'Feature',
    id: path.id,
    geometry,
    properties: {
      path_id: path.id,
      lot_number: lotNumber,
      block_number: blockNumber,
      area_sqm: area,
      status: 'vacant', // Default status
    },
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
  const svgPath = path.join(
    __dirname,
    '../LAGUNA-HILLS-MAP.svg.2026_01_23_14_02_46.0.svg',
  );

  if (!fs.existsSync(svgPath)) {
    console.error(`SVG file not found: ${svgPath}`);
    process.exit(1);
  }

  const svgContent = fs.readFileSync(svgPath, 'utf-8');
  console.log(`✓ Loaded SVG file (${svgContent.length} bytes)`);

  // Load lot mappings if provided
  const lotMappings = mappingPath ? loadLotMappings(mappingPath) : new Map();

  // Extract paths
  const paths = extractPaths(svgContent);
  console.log(`✓ Extracted ${paths.length} paths from SVG`);

  // Classify paths
  const { lots, streets, blocks } = classifyPaths(paths);
  console.log(`✓ Classified ${lots.length} lots, ${streets.length} streets`);

  // Convert to GeoJSON features
  const lotFeatures = lots.map((p) => pathToGeoJSONFeature(p, 'Polygon', lotMappings));
  const streetFeatures = streets.map((p) => pathToGeoJSONFeature(p, 'LineString'));
  const blockFeatures = blocks.map((p) => pathToGeoJSONFeature(p, 'Polygon'));

  // Create GeoJSON collections
  const lotsGeoJSON = createFeatureCollection(lotFeatures);
  const streetsGeoJSON = createFeatureCollection(streetFeatures);
  const blocksGeoJSON = createFeatureCollection(blockFeatures);

  // Ensure output directory exists
  const outputDir = path.join(__dirname, '../public/data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write output files
  const lotsPath = path.join(outputDir, 'lots.geojson');
  const streetsPath = path.join(outputDir, 'streets.geojson');
  const blocksPath = path.join(outputDir, 'blocks.geojson');

  fs.writeFileSync(lotsPath, JSON.stringify(lotsGeoJSON, null, 2));
  fs.writeFileSync(streetsPath, JSON.stringify(streetsGeoJSON, null, 2));
  fs.writeFileSync(blocksPath, JSON.stringify(blocksGeoJSON, null, 2));

  console.log('\nConversion complete!');
  console.log('='.repeat(50));
  console.log(`Output files:`);
  console.log(`  - ${lotsPath} (${lotFeatures.length} features)`);
  console.log(`  - ${streetsPath} (${streetFeatures.length} features)`);
  console.log(`  - ${blocksPath} (${blockFeatures.length} features)`);

  // Summary statistics
  console.log('\n--- Summary ---');
  console.log(`SVG dimensions: ${SVG_WIDTH}x${SVG_HEIGHT}`);
  console.log(`Total paths processed: ${paths.length}`);
  console.log(`Lots (closed polygons): ${lotFeatures.length}`);
  console.log(`Streets (open polylines): ${streetFeatures.length}`);

  // Calculate total lot area
  const totalArea = lotFeatures.reduce((sum, f) => {
    return sum + ((f.properties.area_sqm as number) || 0);
  }, 0);
  console.log(`Total lot area: ${totalArea.toFixed(2)} square pixels`);
  console.log(`Average lot area: ${(totalArea / lotFeatures.length || 0).toFixed(2)} square pixels`);
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
