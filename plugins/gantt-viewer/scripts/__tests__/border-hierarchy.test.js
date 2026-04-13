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

describe('要件1: 区切り線の階層的な強弱', () => {
  describe('CSS変数', () => {
    it('should define --color-border-project CSS variable', () => {
      assert.match(htmlSrc, /--color-border-project\s*:/, 'Missing CSS variable --color-border-project');
    });

    it('should define --color-border-group CSS variable', () => {
      assert.match(htmlSrc, /--color-border-group\s*:/, 'Missing CSS variable --color-border-group');
    });
  });

  describe('サイドバー側のボーダー', () => {
    it('should have sidebar-project border thicker than default (2px)', () => {
      // Why: project boundary must be the most prominent separator
      assert.match(
        htmlSrc,
        /\.sidebar-project[^}]*border-bottom\s*:\s*2px\s+solid/,
        'sidebar-project should have 2px border-bottom for project boundary emphasis',
      );
    });
  });

  describe('タイムライン側のボーダー', () => {
    it('should apply border-bottom override for timeline-row.project-row', () => {
      // Why: timeline project rows need the same visual emphasis as sidebar
      assert.match(
        htmlSrc,
        /\.timeline-row\.project-row[^}]*border-bottom/,
        'Missing border-bottom for .timeline-row.project-row',
      );
    });

    it('should apply border-bottom override for timeline-row.group-row', () => {
      // Why: group boundaries need medium-strength separators
      assert.match(
        htmlSrc,
        /\.timeline-row\.group-row[^}]*border-bottom/,
        'Missing border-bottom for .timeline-row.group-row',
      );
    });

    it('should use project border variable for project-row border', () => {
      assert.match(
        htmlSrc,
        /\.timeline-row\.project-row[^}]*var\(--color-border-project\)/,
        'project-row border should use --color-border-project variable',
      );
    });

    it('should use group border variable for group-row border', () => {
      assert.match(
        htmlSrc,
        /\.timeline-row\.group-row[^}]*var\(--color-border-group\)/,
        'group-row border should use --color-border-group variable',
      );
    });

    it('should have project-row border thicker than group-row border', () => {
      // Why: visual hierarchy requires project > group > task
      const projectMatch = htmlSrc.match(/\.timeline-row\.project-row[^}]*border-bottom\s*:\s*(\d+)px/);
      const groupMatch = htmlSrc.match(/\.timeline-row\.group-row[^}]*border-bottom\s*:\s*(\d+)px/);
      assert.ok(projectMatch, 'Could not find project-row border-bottom width');
      assert.ok(groupMatch, 'Could not find group-row border-bottom width');
      const projectWidth = parseInt(projectMatch[1], 10);
      const groupWidth = parseInt(groupMatch[1], 10);
      assert.ok(
        projectWidth > groupWidth,
        `project-row border (${projectWidth}px) should be thicker than group-row border (${groupWidth}px)`,
      );
    });
  });
});
