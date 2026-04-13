import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = join(__dirname, '../../templates/gantt.html');
const RENDER_PATH = join(__dirname, '../../templates/gantt-render.js');
const UI_PATH = join(__dirname, '../../templates/gantt-ui.js');
const htmlSrc = readFileSync(HTML_PATH, 'utf8');
const renderSrc = readFileSync(RENDER_PATH, 'utf8');
const uiSrc = readFileSync(UI_PATH, 'utf8');

describe('regression: requirement-gap — sidebar/timeline border consistency', () => {
  it('should use --color-border-group variable in sidebar-group border', () => {
    // Why: sidebar-group must use the same CSS variable as timeline-row.group-row
    assert.match(
      htmlSrc,
      /\.sidebar-group[^}]*var\(--color-border-group\)/,
      '.sidebar-group must use var(--color-border-group) for border consistency with timeline side',
    );
  });

  it('should not have hardcoded #ddd in sidebar-group border-bottom', () => {
    // Why: hardcoded color causes inconsistency with timeline side
    const sidebarGroupMatch = htmlSrc.match(/\.sidebar-group\s*\{[^}]*\}/);
    assert.ok(sidebarGroupMatch, 'Could not find .sidebar-group rule');
    assert.ok(
      !sidebarGroupMatch[0].includes('border-bottom: 1px solid #ddd'),
      '.sidebar-group border-bottom should not use hardcoded #ddd',
    );
  });
});

describe('regression: requirement-gap — crosshair-col uses column width', () => {
  it('should not have hardcoded width: 1px in crosshair-col CSS', () => {
    // Why: column highlight must cover the full date column, not just 1px
    const crosshairColMatch = htmlSrc.match(/\.crosshair-col\s*\{[^}]*\}/);
    assert.ok(crosshairColMatch, 'Could not find .crosshair-col rule');
    assert.ok(
      !crosshairColMatch[0].match(/width\s*:\s*1px/),
      '.crosshair-col should not have width: 1px — it must cover the full column width',
    );
  });

  it('should use GanttRender.getColWidth() in crosshair handler', () => {
    // Why: column width depends on zoom/mode, must use the public API
    assert.match(
      uiSrc,
      /getColWidth\(\)/,
      'bindCrosshairHighlight should call getColWidth() for column-width snap',
    );
  });

  it('should expose getColWidth in GanttRender public API', () => {
    // Why: gantt-ui.js needs access to column width for crosshair snap
    assert.match(
      renderSrc,
      /getColWidth[,\s]/,
      'GanttRender must expose getColWidth in its return object',
    );
  });
});

describe('regression: requirement-gap — load view header month boundary', () => {
  it('should apply header-cell-month-start in load view header', () => {
    // Why: requirement says "header, body, load view all" must have month boundary
    // Count occurrences of header-cell-month-start — need at least 2 (main header + load view header)
    const matches = renderSrc.match(/header-cell-month-start/g) || [];
    assert.ok(
      matches.length >= 2,
      `Expected header-cell-month-start in at least 2 places (main header + load view header), found ${matches.length}`,
    );
  });
});

describe('regression: dead-code — no write-only variables in gantt-ui.js', () => {
  it('should not have _state variable that is assigned but never read', () => {
    // Why: _state was assigned in bindEvents but never referenced elsewhere
    const declarations = uiSrc.match(/let\s+_state\b/g) || [];
    assert.equal(
      declarations.length,
      0,
      'gantt-ui.js should not declare _state — it was write-only dead code',
    );
  });
});

describe('regression: design-violation — crosshair scroll coordinate', () => {
  it('should not double-add scrollTop/scrollLeft in crosshair handler', () => {
    // Why: getBoundingClientRect() already accounts for scroll position
    const funcStart = uiSrc.indexOf('function bindCrosshairHighlight');
    if (funcStart === -1) return;
    let braceCount = 0;
    let funcBody = '';
    let started = false;
    for (let i = funcStart; i < uiSrc.length; i++) {
      if (uiSrc[i] === '{') { braceCount++; started = true; }
      if (uiSrc[i] === '}') { braceCount--; }
      if (started) funcBody += uiSrc[i];
      if (started && braceCount === 0) break;
    }
    assert.ok(
      !funcBody.includes('scrollTop'),
      'bindCrosshairHighlight should not add scrollTop — getBoundingClientRect already accounts for scroll',
    );
    assert.ok(
      !funcBody.includes('scrollLeft'),
      'bindCrosshairHighlight should not add scrollLeft — getBoundingClientRect already accounts for scroll',
    );
  });
});

describe('regression: dead-code — no surplus arguments to bindEvents', () => {
  it('should not pass arguments to GanttUI.bindEvents()', () => {
    // Why: bindEvents takes no parameters; passing state is dead code
    assert.ok(
      !renderSrc.includes('bindEvents(state)'),
      'GanttUI.bindEvents() should be called without arguments — bindEvents takes no parameters',
    );
  });
});
