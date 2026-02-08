const fs = require('fs');

const svg = fs.readFileSync('LAGUNA-HILLS-MAP-v2.svg', 'utf-8');
const geo = JSON.parse(fs.readFileSync('public/data/lots.geojson', 'utf-8'));

// SVG height for Y-flip (viewBox height from the SVG)
const SVG_HEIGHT = 3456;

// Group labels by block
const labelsByBlock = new Map();

geo.features.forEach(f => {
  const coords = f.geometry.coordinates[0];
  const cx = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const cy = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  // Flip Y-axis to match SVG coordinate system
  const svgY = SVG_HEIGHT - cy;

  // Parse block and lot from ID
  const match = f.id.match(/^(B\d+)-L(\d+)(-.*)?$/);
  if (match) {
    const block = match[1];
    const lot = match[2];
    const suffix = match[3] || '';

    // For normal lots, show only "LXX"
    // For special lots, show full label with suffix
    const labelText = suffix ? `L${lot}${suffix}` : `L${lot}`;

    // Add to appropriate block group
    if (!labelsByBlock.has(block)) {
      labelsByBlock.set(block, []);
    }
    labelsByBlock.get(block).push({
      id: f.id,
      text: labelText,
      x: cx.toFixed(1),
      y: svgY.toFixed(1)
    });
  } else {
    // For lots that don't match the pattern (e.g., special areas), keep full label
    // Put them in a "misc" group
    if (!labelsByBlock.has('misc')) {
      labelsByBlock.set('misc', []);
    }
    labelsByBlock.get('misc').push({
      id: f.id,
      text: f.id,
      x: cx.toFixed(1),
      y: svgY.toFixed(1)
    });
  }
});

// Generate SVG with groups per block
let labels = '  <g id="lot-labels" style="font-family:sans-serif;font-size:10px;text-anchor:middle;fill:#000;stroke:white;stroke-width:1.5px;paint-order:stroke">\n';

// Sort blocks for consistent output
const sortedBlocks = Array.from(labelsByBlock.entries()).sort((a, b) => a[0].localeCompare(b[0]));

for (const [block, blockLabels] of sortedBlocks) {
  labels += `    <g id="lot-labels-${block}">\n`;
  for (const label of blockLabels) {
    labels += `      <text id="${label.id}" x="${label.x}" y="${label.y}">${label.text}</text>\n`;
  }
  labels += `    </g>\n`;
}

labels += '  </g>\n';

let out = svg.replace('</svg>', labels + '</svg>');

// Add thicker stroke to block paths for block boundaries
// Modify the existing stroke-width in the style attribute for block paths
out = out.replace(
  /(id=["']Block \d+["'][^>]*style="[^"]*stroke-width:)1\.33333/g,
  '$15'
);

fs.writeFileSync('LAGUNA-HILLS-MAP-labeled.svg', out);
console.log('Created LAGUNA-HILLS-MAP-labeled.svg with ' + geo.features.length + ' labels');
