import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = join(__dirname, '../../templates/gantt.html');
const UI_PATH = join(__dirname, '../../templates/gantt-ui.js');
const htmlSrc = readFileSync(HTML_PATH, 'utf8');
const uiSrc = readFileSync(UI_PATH, 'utf8');

describe('要件3: クリックで行・列の十字ハイライト', () => {
  describe('CSS定義', () => {
    it('should define --color-highlight-row CSS variable', () => {
      assert.match(htmlSrc, /--color-highlight-row\s*:/, 'Missing CSS variable --color-highlight-row');
    });

    it('should define --color-highlight-col CSS variable', () => {
      assert.match(htmlSrc, /--color-highlight-col\s*:/, 'Missing CSS variable --color-highlight-col');
    });

    it('should define .crosshair-row CSS rule', () => {
      assert.match(htmlSrc, /\.crosshair-row/, 'Missing .crosshair-row CSS rule');
    });

    it('should define .crosshair-col CSS rule', () => {
      assert.match(htmlSrc, /\.crosshair-col/, 'Missing .crosshair-col CSS rule');
    });

    it('should set crosshair-row to position absolute', () => {
      assert.match(
        htmlSrc,
        /\.crosshair-row[^}]*position\s*:\s*absolute/,
        '.crosshair-row must be absolutely positioned',
      );
    });

    it('should set crosshair-col to position absolute', () => {
      assert.match(
        htmlSrc,
        /\.crosshair-col[^}]*position\s*:\s*absolute/,
        '.crosshair-col must be absolutely positioned',
      );
    });

    it('should set pointer-events: none on crosshair elements', () => {
      // Why: crosshair overlays must not intercept clicks on task bars
      assert.match(
        htmlSrc,
        /\.crosshair-row[^}]*pointer-events\s*:\s*none/,
        '.crosshair-row must have pointer-events: none',
      );
      assert.match(
        htmlSrc,
        /\.crosshair-col[^}]*pointer-events\s*:\s*none/,
        '.crosshair-col must have pointer-events: none',
      );
    });

    it('should use highlight CSS variables for crosshair backgrounds', () => {
      assert.match(
        htmlSrc,
        /\.crosshair-row[^}]*var\(--color-highlight-row\)/,
        '.crosshair-row should use --color-highlight-row variable',
      );
      assert.match(
        htmlSrc,
        /\.crosshair-col[^}]*var\(--color-highlight-col\)/,
        '.crosshair-col should use --color-highlight-col variable',
      );
    });
  });

  describe('イベントバインディング', () => {
    it('should have bindCrosshairHighlight function', () => {
      assert.match(
        uiSrc,
        /function\s+bindCrosshairHighlight/,
        'Missing bindCrosshairHighlight function in gantt-ui.js',
      );
    });

    it('should call bindCrosshairHighlight from bindEvents', () => {
      assert.match(
        uiSrc,
        /bindCrosshairHighlight\s*\(/,
        'bindCrosshairHighlight should be called from bindEvents',
      );
    });
  });

  describe('クリック処理', () => {
    it('should reference timeline-body for crosshair click handling', () => {
      // Why: crosshair highlight listens on #timeline-body
      assert.match(
        uiSrc,
        /timeline-body/,
        'Should reference timeline-body element for crosshair handling',
      );
    });

    it('should use crosshair-row class name in JS', () => {
      assert.match(
        uiSrc,
        /crosshair-row/,
        'Should reference crosshair-row class for row highlight element',
      );
    });

    it('should use crosshair-col class name in JS', () => {
      assert.match(
        uiSrc,
        /crosshair-col/,
        'Should reference crosshair-col class for column highlight element',
      );
    });
  });

  describe('既存機能との共存', () => {
    it('should still have popover click handler (bar click)', () => {
      // Why: crosshair must not replace the existing popover behavior
      assert.match(
        uiSrc,
        /bindPopoverEvents/,
        'bindPopoverEvents must still exist',
      );
    });

    it('should still have dependency highlight on dblclick', () => {
      // Why: dblclick dependency highlight must coexist with crosshair
      assert.match(
        uiSrc,
        /bindDependencyHighlight/,
        'bindDependencyHighlight must still exist',
      );
    });

    it('should not use stopPropagation in crosshair handler', () => {
      // Why: stopPropagation would break popover and dependency highlight
      // Extract the bindCrosshairHighlight function body
      const funcStart = uiSrc.indexOf('function bindCrosshairHighlight');
      if (funcStart === -1) {
        // Function doesn't exist yet — will fail on the function existence test
        return;
      }
      // Find the function body by counting braces
      let braceCount = 0;
      let funcBody = '';
      let started = false;
      for (let i = funcStart; i < uiSrc.length; i++) {
        if (uiSrc[i] === '{') {
          braceCount++;
          started = true;
        }
        if (uiSrc[i] === '}') {
          braceCount--;
        }
        if (started) funcBody += uiSrc[i];
        if (started && braceCount === 0) break;
      }
      assert.ok(
        !funcBody.includes('stopPropagation'),
        'bindCrosshairHighlight should not use stopPropagation — it would break popover and dependency highlight',
      );
    });
  });
});
