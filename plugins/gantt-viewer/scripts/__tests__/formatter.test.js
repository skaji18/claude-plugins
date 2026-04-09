import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatCheckResults, formatSummary } from '../lib/formatter.js';

describe('formatter', () => {
  describe('formatCheckResults', () => {
    it('should format ERROR results with [ERROR] prefix', () => {
      // Given
      const results = [
        { level: 'ERROR', type: 'dependency_violation', taskId: 'impl', message: '"impl" (開始: 2026-04-10) は依存先 "design" (終了: 2026-04-14) より前に開始' },
      ];

      // When
      const output = formatCheckResults(results);

      // Then
      assert.ok(output.includes('[ERROR]'));
      assert.ok(output.includes('impl'));
      assert.ok(output.includes('design'));
    });

    it('should format WARN results with [WARN] prefix', () => {
      // Given
      const results = [
        { level: 'WARN', type: 'delayed', taskId: 'design', message: '"design" の end_date (2026-04-05) は今日 (2026-04-09) より前' },
      ];

      // When
      const output = formatCheckResults(results);

      // Then
      assert.ok(output.includes('[WARN]'));
    });

    it('should format INFO results with [INFO] prefix', () => {
      // Given
      const results = [
        { level: 'INFO', type: 'critical_path', taskId: null, message: 'クリティカルパス: design → impl → test (合計 15 日)' },
      ];

      // When
      const output = formatCheckResults(results);

      // Then
      assert.ok(output.includes('[INFO]'));
      assert.ok(output.includes('クリティカルパス'));
    });

    it('should include summary line with counts', () => {
      // Given
      const results = [
        { level: 'ERROR', type: 'dependency_violation', taskId: 'a', message: 'error 1' },
        { level: 'ERROR', type: 'date_contradiction', taskId: 'b', message: 'error 2' },
        { level: 'WARN', type: 'delayed', taskId: 'c', message: 'warning 1' },
      ];

      // When
      const output = formatCheckResults(results);

      // Then
      assert.ok(output.includes('ERROR'));
      assert.ok(output.includes('2'));
      assert.ok(output.includes('WARN'));
      assert.ok(output.includes('1'));
    });

    it('should return success message when no issues found', () => {
      // Given
      const results = [];

      // When
      const output = formatCheckResults(results);

      // Then
      assert.ok(typeof output === 'string');
      assert.ok(output.length > 0);
    });

    it('should handle mixed levels in correct order', () => {
      // Given
      const results = [
        { level: 'INFO', type: 'critical_path', taskId: null, message: 'info' },
        { level: 'ERROR', type: 'dependency_violation', taskId: 'a', message: 'error' },
        { level: 'WARN', type: 'delayed', taskId: 'b', message: 'warning' },
      ];

      // When
      const output = formatCheckResults(results);

      // Then: ERROR should appear before WARN, WARN before INFO
      const errorIdx = output.indexOf('[ERROR]');
      const warnIdx = output.indexOf('[WARN]');
      const infoIdx = output.indexOf('[INFO]');
      assert.ok(errorIdx < warnIdx);
      assert.ok(warnIdx < infoIdx);
    });
  });

  describe('formatSummary', () => {
    it('should include project name', () => {
      // Given
      const project = { name: 'Sample Project' };
      const tasks = [
        { id: 'a', name: 'Task A', assignee: 'Tanaka', progress: 100, start_date: '2026-04-10', end_date: '2026-04-14', depends_on: [], effort: 3, group: 'G', milestone: false },
      ];
      const criticalPath = { path: ['a'], totalDays: 5 };
      const today = '2026-04-01';

      // When
      const output = formatSummary(project, tasks, criticalPath, today);

      // Then
      assert.ok(output.includes('Sample Project'));
    });

    it('should include task count', () => {
      // Given
      const project = { name: 'Test' };
      const tasks = [
        { id: 'a', name: 'A', assignee: 'X', progress: 100, start_date: '2026-04-10', end_date: '2026-04-14', depends_on: [], effort: 3, group: 'G', milestone: false },
        { id: 'b', name: 'B', assignee: 'Y', progress: 50, start_date: '2026-04-15', end_date: '2026-04-18', depends_on: [], effort: 2, group: 'G', milestone: false },
        { id: 'c', name: 'C', assignee: 'Z', progress: 0, start_date: '2026-04-19', end_date: '2026-04-22', depends_on: [], effort: 2, group: 'G', milestone: false },
      ];
      const criticalPath = { path: ['a', 'b', 'c'], totalDays: 13 };
      const today = '2026-04-01';

      // When
      const output = formatSummary(project, tasks, criticalPath, today);

      // Then
      assert.ok(output.includes('3'));
    });

    it('should categorize tasks into completed, in-progress, and not-started', () => {
      // Given
      const project = { name: 'Test' };
      const tasks = [
        { id: 'a', name: 'Done', assignee: 'X', progress: 100, start_date: '2026-04-10', end_date: '2026-04-14', depends_on: [], effort: 3, group: 'G', milestone: false },
        { id: 'b', name: 'WIP', assignee: 'Y', progress: 50, start_date: '2026-04-15', end_date: '2026-04-18', depends_on: [], effort: 2, group: 'G', milestone: false },
        { id: 'c', name: 'Todo', assignee: 'Z', progress: 0, start_date: '2026-04-19', end_date: '2026-04-22', depends_on: [], effort: 2, group: 'G', milestone: false },
      ];
      const criticalPath = { path: ['a'], totalDays: 5 };
      const today = '2026-04-01';

      // When
      const output = formatSummary(project, tasks, criticalPath, today);

      // Then
      assert.ok(typeof output === 'string');
      assert.ok(output.length > 0);
    });

    it('should list delayed tasks with details', () => {
      // Given
      const project = { name: 'Test' };
      const tasks = [
        { id: 'design', name: 'Design', assignee: 'Tanaka', progress: 80, start_date: '2026-04-01', end_date: '2026-04-05', depends_on: [], effort: 3, group: 'G', milestone: false },
      ];
      const criticalPath = { path: ['design'], totalDays: 5 };
      const today = '2026-04-09';

      // When
      const output = formatSummary(project, tasks, criticalPath, today);

      // Then
      assert.ok(output.includes('design') || output.includes('Design'));
      assert.ok(output.includes('Tanaka'));
    });

    it('should include critical path display', () => {
      // Given
      const project = { name: 'Test' };
      const tasks = [
        { id: 'a', name: 'A', assignee: 'X', progress: 0, start_date: '2026-04-10', end_date: '2026-04-14', depends_on: [], effort: 3, group: 'G', milestone: false },
        { id: 'b', name: 'B', assignee: 'Y', progress: 0, start_date: '2026-04-15', end_date: '2026-04-18', depends_on: ['a'], effort: 2, group: 'G', milestone: false },
      ];
      const criticalPath = { path: ['a', 'b'], totalDays: 9 };
      const today = '2026-04-01';

      // When
      const output = formatSummary(project, tasks, criticalPath, today);

      // Then
      assert.ok(output.includes('a'));
      assert.ok(output.includes('b'));
    });
  });
});
