import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_PATH = join(__dirname, '../../templates/gantt-render.js');
const renderSrc = readFileSync(RENDER_PATH, 'utf8');

describe('gantt-render.js strict mode safety', () => {
  it('should not reference undeclared variable "isHidden"', () => {
    // Why: strict mode throws ReferenceError on undeclared variables.
    // The correct call is isTaskRowHidden(row).
    const matches = renderSrc.match(/\bisHidden\b/g);
    assert.equal(
      matches,
      null,
      'Found undeclared "isHidden" — use isTaskRowHidden(row) instead',
    );
  });

  it('should use isTaskRowHidden(row) for all task-row hidden checks', () => {
    // Why: task-type rows determine visibility via isTaskRowHidden(row).
    // Every branch that checks hidden state for a task row must call this
    // function, not use a bare variable or inline the collapsed-set logic.
    const lines = renderSrc.split('\n');
    const taskPositionsLines = lines.filter(
      (line) => line.includes('taskPositions') && line.includes('set('),
    );

    // There should be at least one taskPositions.set() call
    assert.ok(
      taskPositionsLines.length > 0,
      'Expected at least one taskPositions.set() call',
    );

    // Each taskPositions.set() should be guarded by isTaskRowHidden, not isHidden
    for (const line of taskPositionsLines) {
      const lineIdx = lines.indexOf(line);
      // Check the surrounding context (5 lines before) for the guard condition
      const contextBefore = lines
        .slice(Math.max(0, lineIdx - 5), lineIdx + 1)
        .join('\n');
      assert.ok(
        !contextBefore.includes('isHidden'),
        `taskPositions.set() at line ${lineIdx + 1} is guarded by undeclared "isHidden" instead of isTaskRowHidden(row)`,
      );
    }
  });

  it('should have consistent hidden-check pattern for task rows in renderTimelineBody', () => {
    // Why: all visibility checks for task-type rows must use isTaskRowHidden(row).
    // Using different patterns (bare variables, inline logic) leads to bugs.
    // Exclude the function definition line; count only call sites
    const callSitePattern = /(?<!function\s)isTaskRowHidden\s*\(\s*row\s*\)/g;
    const isTaskRowHiddenCalls = renderSrc.match(callSitePattern) || [];

    // isTaskRowHidden(row) should be called at these 4 sites:
    // - sidebar hidden class assignment
    // - timeline hidden class assignment
    // - taskPositions guard (the fix target)
    // - rowIdx visibility counting
    assert.ok(
      isTaskRowHiddenCalls.length >= 4,
      `Expected at least 4 isTaskRowHidden(row) call sites, found ${isTaskRowHiddenCalls.length}. ` +
        'All task-row hidden checks must use isTaskRowHidden(row)',
    );
  });
});
