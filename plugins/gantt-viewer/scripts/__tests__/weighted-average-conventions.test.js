import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Why: calculateSummary exists in two files — ESM (Node/test) and IIFE (browser).
// Both must use duration-weighted average. This test prevents regression to simple average.
const SOURCES = [
  {
    label: 'core-extensions.js (Node/ESM)',
    path: join(__dirname, '../lib/core-extensions.js'),
  },
  {
    label: 'gantt-core.js (browser/IIFE)',
    path: join(__dirname, '../../templates/gantt-core.js'),
  },
];

describe('weighted average convention', () => {
  for (const { label, path } of SOURCES) {
    it(`${label}: calculateSummary should not use simple average (tasks.length divisor)`, () => {
      const src = readFileSync(path, 'utf8');

      // Extract the calculateSummary function body
      const fnStart = src.indexOf('function calculateSummary');
      assert.ok(fnStart !== -1, `calculateSummary not found in ${label}`);

      // Find the matching closing brace by counting braces
      let depth = 0;
      let fnEnd = -1;
      for (let i = src.indexOf('{', fnStart); i < src.length; i++) {
        if (src[i] === '{') depth++;
        if (src[i] === '}') depth--;
        if (depth === 0) {
          fnEnd = i + 1;
          break;
        }
      }
      assert.ok(fnEnd > fnStart, `Could not parse calculateSummary body in ${label}`);

      const fnBody = src.slice(fnStart, fnEnd);

      // Simple average pattern: dividing by tasks.length
      const simpleAvgPattern = /tasks\.length(?!\s*===\s*0)/;
      const match = fnBody.match(simpleAvgPattern);
      assert.equal(
        match,
        null,
        `${label}: found "tasks.length" divisor in calculateSummary — use duration-weighted average instead`,
      );
    });
  }
});
