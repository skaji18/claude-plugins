import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getDelayedTasks,
  calculateSummary,
  filterTasks,
  assignColors,
  milestoneDaysLeft,
  calculateAssigneeLoad,
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
    group: 'Phase 1',
    milestone: false,
    ...overrides,
  };
}

describe('getDelayedTasks', () => {
  it('should detect tasks whose end_date is past today and progress < 100', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', end_date: '2026-04-05', progress: 50 }),
      makeTask({ id: 'b', end_date: '2026-04-20', progress: 50 }),
    ];
    const today = '2026-04-10';

    // When
    const result = getDelayedTasks(tasks, today);

    // Then
    assert.ok(result instanceof Set);
    assert.ok(result.has('a'));
    assert.ok(!result.has('b'));
  });

  it('should treat end_date == today with progress < 100 as delayed', () => {
    // Given
    const tasks = [
      makeTask({ id: 'edge', end_date: '2026-04-10', progress: 80 }),
    ];
    const today = '2026-04-10';

    // When
    const result = getDelayedTasks(tasks, today);

    // Then
    assert.ok(result.has('edge'));
  });

  it('should not mark completed tasks as delayed even if end_date is past', () => {
    // Given
    const tasks = [
      makeTask({ id: 'done', end_date: '2026-04-05', progress: 100 }),
    ];
    const today = '2026-04-10';

    // When
    const result = getDelayedTasks(tasks, today);

    // Then
    assert.ok(!result.has('done'));
  });

  it('should return empty set when no tasks are delayed', () => {
    // Given
    const tasks = [
      makeTask({ id: 'future', end_date: '2026-04-20', progress: 0 }),
      makeTask({ id: 'done', end_date: '2026-04-05', progress: 100 }),
    ];
    const today = '2026-04-10';

    // When
    const result = getDelayedTasks(tasks, today);

    // Then
    assert.equal(result.size, 0);
  });
});

describe('calculateSummary', () => {
  it('should calculate correct average progress', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', progress: 100 }),
      makeTask({ id: 'b', progress: 50 }),
      makeTask({ id: 'c', progress: 0 }),
    ];
    const criticalPath = { path: new Set(['a', 'b', 'c']), totalDays: 15 };
    const today = '2026-04-01';

    // When
    const result = calculateSummary(tasks, criticalPath, today);

    // Then
    assert.equal(result.overallProgress, 50);
  });

  it('should count delayed tasks correctly', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', end_date: '2026-04-05', progress: 80 }),
      makeTask({ id: 'b', end_date: '2026-04-05', progress: 30 }),
      makeTask({ id: 'c', end_date: '2026-04-20', progress: 0 }),
    ];
    const criticalPath = { path: new Set(['a', 'b']), totalDays: 10 };
    const today = '2026-04-10';

    // When
    const result = calculateSummary(tasks, criticalPath, today);

    // Then
    assert.equal(result.delayedCount, 2);
  });

  it('should calculate critical path remaining days', () => {
    // Given: CP ends at 2026-04-20, today is 2026-04-10 => 10 days left
    const tasks = [
      makeTask({ id: 'a', start_date: '2026-04-10', end_date: '2026-04-15', progress: 50 }),
      makeTask({ id: 'b', start_date: '2026-04-16', end_date: '2026-04-20', progress: 0, depends_on: ['a'] }),
    ];
    const criticalPath = { path: new Set(['a', 'b']), totalDays: 11 };
    const today = '2026-04-10';

    // When
    const result = calculateSummary(tasks, criticalPath, today);

    // Then
    assert.equal(typeof result.criticalDays, 'number');
    assert.equal(result.criticalDays, 10);
  });

  it('should handle zero tasks gracefully', () => {
    // Given
    const tasks = [];
    const criticalPath = { path: new Set(), totalDays: 0 };
    const today = '2026-04-10';

    // When
    const result = calculateSummary(tasks, criticalPath, today);

    // Then
    assert.equal(result.overallProgress, 0);
    assert.equal(result.delayedCount, 0);
    assert.equal(result.criticalDays, 0);
  });
});

describe('filterTasks', () => {
  const tasks = [
    makeTask({ id: 'a', assignee: 'Tanaka', group: 'Design', end_date: '2026-04-05', progress: 50 }),
    makeTask({ id: 'b', assignee: 'Suzuki', group: 'Design', end_date: '2026-04-20', progress: 0 }),
    makeTask({ id: 'c', assignee: 'Tanaka', group: 'Dev', end_date: '2026-04-20', progress: 100 }),
    makeTask({ id: 'd', assignee: 'Suzuki', group: 'Dev', end_date: '2026-04-03', progress: 10 }),
  ];
  const today = '2026-04-10';
  const criticalPath = new Set(['a', 'b']);

  it('should filter by assignee', () => {
    // When
    const result = filterTasks(tasks, { assignee: 'Tanaka' }, { today, criticalPath });

    // Then
    assert.ok(result instanceof Set);
    assert.ok(result.has('a'));
    assert.ok(!result.has('b'));
    assert.ok(result.has('c'));
    assert.ok(!result.has('d'));
  });

  it('should filter by group', () => {
    // When
    const result = filterTasks(tasks, { group: 'Design' }, { today, criticalPath });

    // Then
    assert.ok(result.has('a'));
    assert.ok(result.has('b'));
    assert.ok(!result.has('c'));
    assert.ok(!result.has('d'));
  });

  it('should filter delayed only', () => {
    // When
    const result = filterTasks(tasks, { delayedOnly: true }, { today, criticalPath });

    // Then: a (end 04-05, progress 50) and d (end 04-03, progress 10) are delayed
    assert.ok(result.has('a'));
    assert.ok(result.has('d'));
    assert.ok(!result.has('b'));
    assert.ok(!result.has('c'));
  });

  it('should filter critical path only', () => {
    // When
    const result = filterTasks(tasks, { criticalOnly: true }, { today, criticalPath });

    // Then
    assert.ok(result.has('a'));
    assert.ok(result.has('b'));
    assert.ok(!result.has('c'));
    assert.ok(!result.has('d'));
  });

  it('should combine multiple filters with AND logic', () => {
    // When: assignee Tanaka AND delayed
    const result = filterTasks(tasks, { assignee: 'Tanaka', delayedOnly: true }, { today, criticalPath });

    // Then: only 'a' matches both
    assert.ok(result.has('a'));
    assert.equal(result.size, 1);
  });

  it('should return all tasks when no filter is applied', () => {
    // When
    const result = filterTasks(tasks, {}, { today, criticalPath });

    // Then
    assert.equal(result.size, 4);
  });
});

describe('assignColors', () => {
  it('should assign different colors to different assignees', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', assignee: 'Tanaka' }),
      makeTask({ id: 'b', assignee: 'Suzuki' }),
    ];

    // When
    const result = assignColors(tasks);

    // Then
    assert.ok(result instanceof Map);
    assert.ok(result.has('Tanaka'));
    assert.ok(result.has('Suzuki'));
    assert.notEqual(result.get('Tanaka').bar, result.get('Suzuki').bar);
  });

  it('should assign the same color to the same assignee', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', assignee: 'Tanaka' }),
      makeTask({ id: 'b', assignee: 'Tanaka' }),
    ];

    // When
    const result = assignColors(tasks);

    // Then
    assert.equal(result.size, 1);
    assert.ok(result.has('Tanaka'));
  });

  it('should return bar and light color properties in HSL format', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', assignee: 'Tanaka' }),
    ];

    // When
    const result = assignColors(tasks);

    // Then
    const colors = result.get('Tanaka');
    assert.ok('bar' in colors);
    assert.ok('light' in colors);
    assert.ok(typeof colors.bar === 'string');
    assert.ok(typeof colors.light === 'string');
    // HSL format check, e.g. "hsl(120, 70%, 50%)" or similar
    assert.match(colors.bar, /hsl/i);
    assert.match(colors.light, /hsl/i);
  });
});

describe('milestoneDaysLeft', () => {
  it('should calculate remaining days for milestone tasks', () => {
    // Given
    const tasks = [
      makeTask({ id: 'ms1', milestone: true, end_date: '2026-04-20' }),
    ];
    const today = '2026-04-10';

    // When
    const result = milestoneDaysLeft(tasks, today);

    // Then
    assert.ok(result instanceof Map);
    assert.equal(result.get('ms1'), 10);
  });

  it('should not include non-milestone tasks', () => {
    // Given
    const tasks = [
      makeTask({ id: 'regular', milestone: false, end_date: '2026-04-20' }),
      makeTask({ id: 'ms', milestone: true, end_date: '2026-04-15' }),
    ];
    const today = '2026-04-10';

    // When
    const result = milestoneDaysLeft(tasks, today);

    // Then
    assert.ok(!result.has('regular'));
    assert.ok(result.has('ms'));
    assert.equal(result.size, 1);
  });

  it('should return negative value for past milestones', () => {
    // Given
    const tasks = [
      makeTask({ id: 'past-ms', milestone: true, end_date: '2026-04-05' }),
    ];
    const today = '2026-04-10';

    // When
    const result = milestoneDaysLeft(tasks, today);

    // Then
    assert.ok(result.get('past-ms') < 0);
    assert.equal(result.get('past-ms'), -5);
  });
});

describe('calculateAssigneeLoad', () => {
  it('should group tasks by assignee', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', assignee: 'Tanaka', start_date: '2026-04-10', end_date: '2026-04-14' }),
      makeTask({ id: 'b', assignee: 'Suzuki', start_date: '2026-04-10', end_date: '2026-04-12' }),
      makeTask({ id: 'c', assignee: 'Tanaka', start_date: '2026-04-15', end_date: '2026-04-18' }),
    ];

    // When
    const result = calculateAssigneeLoad(tasks);

    // Then
    assert.ok(result instanceof Map);
    assert.equal(result.get('Tanaka').length, 2);
    assert.equal(result.get('Suzuki').length, 1);
  });

  it('should include correct task details in each entry', () => {
    // Given
    const tasks = [
      makeTask({ id: 'x', assignee: 'Tanaka', start_date: '2026-04-10', end_date: '2026-04-14' }),
    ];

    // When
    const result = calculateAssigneeLoad(tasks);

    // Then
    const tanakaLoad = result.get('Tanaka');
    assert.equal(tanakaLoad.length, 1);
    assert.equal(tanakaLoad[0].taskId, 'x');
    assert.equal(tanakaLoad[0].start_date, '2026-04-10');
    assert.equal(tanakaLoad[0].end_date, '2026-04-14');
  });

  it('should correctly list all tasks for an assignee with multiple tasks', () => {
    // Given
    const tasks = [
      makeTask({ id: 't1', assignee: 'Yamada', start_date: '2026-04-10', end_date: '2026-04-12' }),
      makeTask({ id: 't2', assignee: 'Yamada', start_date: '2026-04-11', end_date: '2026-04-15' }),
      makeTask({ id: 't3', assignee: 'Yamada', start_date: '2026-04-16', end_date: '2026-04-20' }),
    ];

    // When
    const result = calculateAssigneeLoad(tasks);

    // Then
    const yamadaLoad = result.get('Yamada');
    assert.equal(yamadaLoad.length, 3);
    const taskIds = yamadaLoad.map((e) => e.taskId);
    assert.ok(taskIds.includes('t1'));
    assert.ok(taskIds.includes('t2'));
    assert.ok(taskIds.includes('t3'));
  });
});
