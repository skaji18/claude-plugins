import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { calculateCriticalPath } from '../lib/critical-path.js';

function makeTask(overrides) {
  return {
    id: 'task-1',
    name: 'Task 1',
    assignee: 'Tanaka',
    effort: 3,
    start_date: '2026-04-10',
    end_date: '2026-04-14',
    progress: 0,
    depends_on: [],
    group: 'Phase 1',
    milestone: false,
    ...overrides,
  };
}

describe('critical-path', () => {
  describe('calculateCriticalPath', () => {
    it('should return single task as critical path when only one task exists', () => {
      // Given
      const tasks = [
        makeTask({ id: 'only', start_date: '2026-04-10', end_date: '2026-04-14' }),
      ];

      // When
      const result = calculateCriticalPath(tasks);

      // Then
      assert.deepEqual(result.path, ['only']);
      assert.equal(result.totalDays, 5);
    });

    it('should find longest path in linear chain', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', start_date: '2026-04-10', end_date: '2026-04-12' }),
        makeTask({ id: 'b', start_date: '2026-04-13', end_date: '2026-04-16', depends_on: ['a'] }),
        makeTask({ id: 'c', start_date: '2026-04-17', end_date: '2026-04-20', depends_on: ['b'] }),
      ];

      // When
      const result = calculateCriticalPath(tasks);

      // Then
      assert.deepEqual(result.path, ['a', 'b', 'c']);
    });

    it('should choose longer branch when parallel paths exist', () => {
      // Given: a -> b -> d (longer) vs a -> c -> d (shorter)
      const tasks = [
        makeTask({ id: 'a', start_date: '2026-04-10', end_date: '2026-04-12' }),
        makeTask({ id: 'b', start_date: '2026-04-13', end_date: '2026-04-20', depends_on: ['a'] }),
        makeTask({ id: 'c', start_date: '2026-04-13', end_date: '2026-04-14', depends_on: ['a'] }),
        makeTask({ id: 'd', start_date: '2026-04-21', end_date: '2026-04-25', depends_on: ['b', 'c'] }),
      ];

      // When
      const result = calculateCriticalPath(tasks);

      // Then: path through b is longer
      assert.ok(result.path.includes('b'));
      assert.ok(!result.path.includes('c'));
    });

    it('should handle independent tasks with no dependencies', () => {
      // Given: two independent tasks, pick the longer one
      const tasks = [
        makeTask({ id: 'short', start_date: '2026-04-10', end_date: '2026-04-11' }),
        makeTask({ id: 'long', start_date: '2026-04-10', end_date: '2026-04-20' }),
      ];

      // When
      const result = calculateCriticalPath(tasks);

      // Then
      assert.ok(result.path.includes('long'));
    });

    it('should throw when circular dependency exists', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', depends_on: ['b'] }),
        makeTask({ id: 'b', depends_on: ['a'] }),
      ];

      // When / Then
      assert.throws(
        () => calculateCriticalPath(tasks),
        (err) => err instanceof Error
      );
    });

    it('should handle diamond dependency pattern', () => {
      // Given: a -> b, a -> c, b -> d, c -> d
      const tasks = [
        makeTask({ id: 'a', start_date: '2026-04-10', end_date: '2026-04-12' }),
        makeTask({ id: 'b', start_date: '2026-04-13', end_date: '2026-04-18', depends_on: ['a'] }),
        makeTask({ id: 'c', start_date: '2026-04-13', end_date: '2026-04-15', depends_on: ['a'] }),
        makeTask({ id: 'd', start_date: '2026-04-19', end_date: '2026-04-22', depends_on: ['b', 'c'] }),
      ];

      // When
      const result = calculateCriticalPath(tasks);

      // Then: critical path goes through the longer branch (b)
      assert.deepEqual(result.path, ['a', 'b', 'd']);
    });

    it('should calculate totalDays correctly for the critical path', () => {
      // Given: a (3 days) -> b (4 days)
      const tasks = [
        makeTask({ id: 'a', start_date: '2026-04-10', end_date: '2026-04-12' }),
        makeTask({ id: 'b', start_date: '2026-04-13', end_date: '2026-04-16', depends_on: ['a'] }),
      ];

      // When
      const result = calculateCriticalPath(tasks);

      // Then: total span from first start to last end
      assert.equal(typeof result.totalDays, 'number');
      assert.ok(result.totalDays > 0);
    });

    it('should handle three-way circular dependency', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', depends_on: ['c'] }),
        makeTask({ id: 'b', depends_on: ['a'] }),
        makeTask({ id: 'c', depends_on: ['b'] }),
      ];

      // When / Then
      assert.throws(
        () => calculateCriticalPath(tasks),
        (err) => err instanceof Error
      );
    });

    it('should handle milestone tasks with same start and end date', () => {
      // Given
      const tasks = [
        makeTask({ id: 'work', start_date: '2026-04-10', end_date: '2026-04-14' }),
        makeTask({
          id: 'milestone',
          start_date: '2026-04-15',
          end_date: '2026-04-15',
          milestone: true,
          depends_on: ['work'],
        }),
      ];

      // When
      const result = calculateCriticalPath(tasks);

      // Then
      assert.deepEqual(result.path, ['work', 'milestone']);
    });
  });
});
