import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  filterTasks,
} from '../lib/core-extensions.js';

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
    project: 'EC Site',
    group: 'Design',
    milestone: false,
    ...overrides,
  };
}

describe('filterTasks: project filter', () => {
  const tasks = [
    makeTask({ id: 'a', project: 'EC Site', group: 'Design', assignee: 'Tanaka' }),
    makeTask({ id: 'b', project: 'EC Site', group: 'Impl', assignee: 'Suzuki' }),
    makeTask({ id: 'c', project: 'Infra', group: 'Plan', assignee: 'Tanaka' }),
    makeTask({ id: 'd', project: 'Infra', assignee: 'Suzuki' }),
  ];
  const today = '2026-04-10';
  const criticalPath = new Set(['a', 'c']);

  it('should filter by project', () => {
    // When
    const result = filterTasks(tasks, { project: 'EC Site' }, { today, criticalPath });

    // Then
    assert.ok(result.has('a'));
    assert.ok(result.has('b'));
    assert.ok(!result.has('c'));
    assert.ok(!result.has('d'));
  });

  it('should return no tasks when project does not match any', () => {
    // When
    const result = filterTasks(tasks, { project: 'Nonexistent' }, { today, criticalPath });

    // Then
    assert.equal(result.size, 0);
  });

  it('should combine project with assignee filter (AND logic)', () => {
    // When
    const result = filterTasks(tasks, { project: 'EC Site', assignee: 'Tanaka' }, { today, criticalPath });

    // Then
    assert.equal(result.size, 1);
    assert.ok(result.has('a'));
  });

  it('should combine project with group filter (AND logic)', () => {
    // When
    const result = filterTasks(tasks, { project: 'EC Site', group: 'Design' }, { today, criticalPath });

    // Then
    assert.equal(result.size, 1);
    assert.ok(result.has('a'));
  });

  it('should combine project with criticalOnly filter', () => {
    // When
    const result = filterTasks(tasks, { project: 'EC Site', criticalOnly: true }, { today, criticalPath });

    // Then
    assert.equal(result.size, 1);
    assert.ok(result.has('a'));
  });

  it('should return all tasks when no filter is applied (including tasks without group)', () => {
    // When
    const result = filterTasks(tasks, {}, { today, criticalPath });

    // Then
    assert.equal(result.size, 4);
  });

  it('should handle tasks without group field in group filter', () => {
    // Given: task 'd' has no group
    const tasksWithUndefinedGroup = [
      makeTask({ id: 'x', project: 'P1', group: 'G1' }),
      makeTask({ id: 'y', project: 'P1', group: undefined }),
    ];

    // When: filter by group
    const result = filterTasks(tasksWithUndefinedGroup, { group: 'G1' }, { today, criticalPath });

    // Then: only 'x' matches
    assert.equal(result.size, 1);
    assert.ok(result.has('x'));
  });
});
