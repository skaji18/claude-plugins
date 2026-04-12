import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RENDER_PATH = join(__dirname, '../../templates/gantt-render.js');
const renderSrc = readFileSync(RENDER_PATH, 'utf8');

describe('gantt-render.js conventions', () => {
  it('should have exactly one visibility check combining projectKey and groupKey (dry-violation guard)', () => {
    const pattern = /state\.collapsed\.has\(row\.projectKey\).*state\.collapsed\.has\(row\.groupKey\)/g;
    const matches = renderSrc.match(pattern) || [];
    assert.equal(matches.length, 1, `Expected 1 definition of the combined check (in isTaskRowHidden), found ${matches.length}`);
  });

  it('should not reference the obsolete groupColors name (naming-mismatch guard)', () => {
    const matches = renderSrc.match(/groupColors/g);
    assert.equal(matches, null, 'Obsolete "groupColors" found — should be "projectColors"');
  });

  it('should not contain dead-code projectColors on state (dead-code guard)', () => {
    // Why: projectColors was set but never read — pure dead code.
    const matches = renderSrc.match(/projectColors/g);
    assert.equal(matches, null, 'Dead-code "projectColors" found on state — remove it');
  });
});
