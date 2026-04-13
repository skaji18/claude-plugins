import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = join(__dirname, '../../templates/gantt.html');
const RENDER_PATH = join(__dirname, '../../templates/gantt-render.js');
const htmlSrc = readFileSync(HTML_PATH, 'utf8');
const renderSrc = readFileSync(RENDER_PATH, 'utf8');

describe('要件2: 月の区切り線を目立たせる', () => {
  describe('CSS定義', () => {
    it('should define --color-grid-month CSS variable', () => {
      assert.match(htmlSrc, /--color-grid-month\s*:/, 'Missing CSS variable --color-grid-month');
    });

    it('should define .grid-line-month style rule', () => {
      assert.match(htmlSrc, /\.grid-line-month/, 'Missing .grid-line-month CSS rule');
    });

    it('should make grid-line-month wider than default grid-line (2px)', () => {
      assert.match(
        htmlSrc,
        /\.grid-line-month[^}]*width\s*:\s*2px/,
        '.grid-line-month should have 2px width',
      );
    });

    it('should use --color-grid-month variable for month grid line background', () => {
      assert.match(
        htmlSrc,
        /\.grid-line-month[^}]*var\(--color-grid-month\)/,
        '.grid-line-month should use --color-grid-month variable',
      );
    });

    it('should define .header-cell-month-start style rule', () => {
      assert.match(
        htmlSrc,
        /\.header-cell-month-start/,
        'Missing .header-cell-month-start CSS rule for month boundary header cells',
      );
    });
  });

  describe('renderTimelineBody の月境界判定', () => {
    it('should check for month start (getDate() === 1) in grid line loop', () => {
      // Why: the grid line loop at renderTimelineBody must detect month boundaries
      assert.match(
        renderSrc,
        /getDate\(\)\s*===\s*1/,
        'Missing month boundary check (getDate() === 1) in grid line generation',
      );
    });

    it('should add grid-line-month class to month boundary grid lines', () => {
      assert.match(
        renderSrc,
        /grid-line-month/,
        'Missing grid-line-month class assignment in render code',
      );
    });
  });

  describe('renderTimelineHeader の月境界判定', () => {
    it('should add header-cell-month-start class in day-mode header', () => {
      assert.match(
        renderSrc,
        /header-cell-month-start/,
        'Missing header-cell-month-start class in header cell generation',
      );
    });
  });

  describe('renderLoadView の月境界判定', () => {
    it('should apply grid-line-month class in load view grid lines too', () => {
      // Why: load view has its own grid line loop that also needs month boundary markers
      // Count occurrences of grid-line-month — should appear in both renderTimelineBody and renderLoadView
      const matches = renderSrc.match(/grid-line-month/g) || [];
      assert.ok(
        matches.length >= 2,
        `Expected grid-line-month in at least 2 places (timeline body + load view), found ${matches.length}`,
      );
    });
  });
});
