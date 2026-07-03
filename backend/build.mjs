// Bundle every Lambda entry point with esbuild.
// Run: npm run build  (from backend/)
// Output: dist/ — mirroring the src/ directory structure.
//
// Each handler is bundled as its own self-contained ESM file so that
// AWS Lambda can load it without a node_modules directory in the zip.
// The AWS SDK v3 is intentionally bundled (not marked external) because
// Node 22 on Lambda does NOT include it in the runtime.

import * as esbuild from 'esbuild';

const entryPoints = [
  'src/authorizer/index.mjs',
  'src/handlers/createExhibition.mjs',
  'src/handlers/exportResponsesCsv.mjs',
  'src/handlers/getActiveExhibition.mjs',
  'src/handlers/listExhibitions.mjs',
  'src/handlers/listResponses.mjs',
  'src/handlers/login.mjs',
  'src/handlers/postResponse.mjs',
  'src/handlers/updateExhibition.mjs',
];

await esbuild.build({
  entryPoints,
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outdir: 'dist',
  // outbase: 'src' preserves the handlers/ and authorizer/ subdirectory
  // structure inside dist/, so handler paths in Terraform stay identical.
  outbase: 'src',
});

console.log('Build complete → dist/');
