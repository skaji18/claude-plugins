import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getDelayedTasks,
  calculateSummary,
  filterTasks,
  assignColors,
  milestoneDaysLeft,
  calculateAssigneeLoad,
  getDateRangeForMode,
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
  it('should calculate duration-weighted average when all tasks have equal duration', () => {
    // Given: all tasks have same duration (4 days each), so weighted average = simple average
    const tasks = [
      makeTask({ id: 'a', start_date: '2026-04-10', end_date: '2026-04-14', progress: 100 }),
      makeTask({ id: 'b', start_date: '2026-04-10', end_date: '2026-04-14', progress: 50 }),
      makeTask({ id: 'c', start_date: '2026-04-10', end_date: '2026-04-14', progress: 0 }),
    ];
    const criticalPath = { path: new Set(['a', 'b', 'c']), totalDays: 15 };
    const today = '2026-04-01';

    // When
    const result = calculateSummary(tasks, criticalPath, today);

    // Then: Σ(4*100 + 4*50 + 4*0) / Σ(4+4+4) = 600/12 = 50
    assert.equal(result.overallProgress, 50);
  });

  it('should weight progress by task duration', () => {
    // Given: short task (2 days, 100%) vs long task (10 days, 0%)
    const tasks = [
      makeTask({ id: 'short', start_date: '2026-04-10', end_date: '2026-04-12', progress: 100 }),
      makeTask({ id: 'long', start_date: '2026-04-10', end_date: '2026-04-20', progress: 0 }),
    ];
    const criticalPath = { path: new Set(), totalDays: 0 };
    const today = '2026-04-01';

    // When
    const result = calculateSummary(tasks, criticalPath, today);

    // Then: Σ(2*100 + 10*0) / Σ(2+10) = 200/12 = 16.67 → 17
    // Simple average would be (100+0)/2 = 50
    assert.equal(result.overallProgress, 17);
  });

  it('should give more weight to longer tasks', () => {
    // Given: 1-day task (100%) vs 14-day task (50%)
    const tasks = [
      makeTask({ id: 'tiny', start_date: '2026-04-10', end_date: '2026-04-11', progress: 100 }),
      makeTask({ id: 'large', start_date: '2026-04-10', end_date: '2026-04-24', progress: 50 }),
    ];
    const criticalPath = { path: new Set(), totalDays: 0 };
    const today = '2026-04-01';

    // When
    const result = calculateSummary(tasks, criticalPath, today);

    // Then: Σ(1*100 + 14*50) / Σ(1+14) = 800/15 = 53.33 → 53
    // Simple average would be (100+50)/2 = 75
    assert.equal(result.overallProgress, 53);
  });

  it('should exclude zero-duration tasks (milestones) from weighted average', () => {
    // Given: milestone (0 days) + regular task (10 days)
    const tasks = [
      makeTask({ id: 'ms', start_date: '2026-04-10', end_date: '2026-04-10', progress: 100, milestone: true }),
      makeTask({ id: 'regular', start_date: '2026-04-10', end_date: '2026-04-20', progress: 50 }),
    ];
    const criticalPath = { path: new Set(), totalDays: 0 };
    const today = '2026-04-01';

    // When
    const result = calculateSummary(tasks, criticalPath, today);

    // Then: Σ(0*100 + 10*50) / Σ(0+10) = 500/10 = 50
    // Milestone's progress is effectively ignored due to zero duration weight
    assert.equal(result.overallProgress, 50);
  });

  it('should return 0 when all tasks have zero duration', () => {
    // Given: all tasks are milestones (0 days)
    const tasks = [
      makeTask({ id: 'ms1', start_date: '2026-04-10', end_date: '2026-04-10', progress: 50, milestone: true }),
      makeTask({ id: 'ms2', start_date: '2026-04-15', end_date: '2026-04-15', progress: 100, milestone: true }),
    ];
    const criticalPath = { path: new Set(), totalDays: 0 };
    const today = '2026-04-01';

    // When
    const result = calculateSummary(tasks, criticalPath, today);

    // Then: totalDuration = 0, so overallProgress = 0 (zero-division guard)
    assert.equal(result.overallProgress, 0);
  });

  it('should calculate weighted average with three tasks of different durations', () => {
    // Given: 3 tasks with varying durations and progress
    const tasks = [
      makeTask({ id: 'a', start_date: '2026-04-01', end_date: '2026-04-04', progress: 100 }), // 3 days
      makeTask({ id: 'b', start_date: '2026-04-01', end_date: '2026-04-11', progress: 50 }),  // 10 days
      makeTask({ id: 'c', start_date: '2026-04-01', end_date: '2026-04-08', progress: 0 }),   // 7 days
    ];
    const criticalPath = { path: new Set(), totalDays: 0 };
    const today = '2026-04-01';

    // When
    const result = calculateSummary(tasks, criticalPath, today);

    // Then: Σ(3*100 + 10*50 + 7*0) / Σ(3+10+7) = 800/20 = 40
    assert.equal(result.overallProgress, 40);
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
    assert.equal(tanakaLoad[0].effort, 3); // from makeTask default
  });

  it('should include effort field when present', () => {
    // Given
    const tasks = [
      makeTask({ id: 'e1', assignee: 'Tanaka', effort: 5 }),
      makeTask({ id: 'e2', assignee: 'Tanaka', effort: undefined }),
    ];

    // When
    const result = calculateAssigneeLoad(tasks);

    // Then
    const entries = result.get('Tanaka');
    assert.equal(entries[0].effort, 5);
    assert.equal(entries[1].effort, null);
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

function formatDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

describe('getDateRangeForMode', () => {
  it('should return month-aligned range for day mode', () => {
    // Given: tasks in April 2026
    const tasks = [
      makeTask({ id: 'a', start_date: '2026-04-05', end_date: '2026-04-20' }),
    ];

    // When
    const range = getDateRangeForMode(tasks, 'day');

    // Then: April 1 to April 30
    assert.equal(formatDate(range.start), '2026-04-01');
    assert.equal(formatDate(range.end), '2026-04-30');
  });

  it('should return month-aligned range for month mode', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', start_date: '2026-04-05', end_date: '2026-04-20' }),
    ];

    // When
    const range = getDateRangeForMode(tasks, 'month');

    // Then: April 1 to April 30
    assert.equal(formatDate(range.start), '2026-04-01');
    assert.equal(formatDate(range.end), '2026-04-30');
  });

  it('should snap start to Monday and end to Sunday for week mode', () => {
    // Given: tasks in April 2026
    // April 1, 2026 is a Wednesday => snap start to Monday March 30
    // April 30, 2026 is a Thursday => snap end to Sunday May 3
    const tasks = [
      makeTask({ id: 'a', start_date: '2026-04-05', end_date: '2026-04-20' }),
    ];

    // When
    const range = getDateRangeForMode(tasks, 'week');

    // Then
    assert.equal(formatDate(range.start), '2026-03-30'); // Monday
    assert.equal(range.start.getDay(), 1); // Monday
    assert.equal(formatDate(range.end), '2026-05-03'); // Sunday
    assert.equal(range.end.getDay(), 0); // Sunday
  });

  it('should not extend range if month already starts on Monday and ends on Sunday', () => {
    // Given: June 2026 starts on Monday, ends on Tuesday
    // => start stays June 1 (Monday), end extends to July 5 (Sunday)
    const tasks = [
      makeTask({ id: 'a', start_date: '2026-06-05', end_date: '2026-06-20' }),
    ];

    // When
    const range = getDateRangeForMode(tasks, 'week');

    // Then: June 1 is Monday, June 30 is Tuesday => end snaps to July 5 (Sunday)
    assert.equal(formatDate(range.start), '2026-06-01');
    assert.equal(range.start.getDay(), 1); // Monday
    assert.equal(range.end.getDay(), 0); // Sunday
  });

  it('should handle tasks spanning multiple months in week mode', () => {
    // Given: tasks from March to May
    const tasks = [
      makeTask({ id: 'a', start_date: '2026-03-10', end_date: '2026-05-15' }),
    ];

    // When
    const range = getDateRangeForMode(tasks, 'week');

    // Then:
    // March 1 is Sunday => snap to Monday Feb 24
    // May 31 is Sunday => stays May 31
    assert.equal(range.start.getDay(), 1); // Monday
    assert.equal(range.end.getDay(), 0); // Sunday
    assert.ok(range.start <= new Date('2026-03-01T00:00:00'));
    assert.ok(range.end >= new Date('2026-05-31T00:00:00'));
  });

  it('should ensure week mode range total days is divisible by 7', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', start_date: '2026-04-10', end_date: '2026-04-25' }),
    ];

    // When
    const range = getDateRangeForMode(tasks, 'week');

    // Then: Monday to Sunday => total days + 1 should be divisible by 7
    const totalDays = Math.round((range.end - range.start) / 86400000) + 1;
    assert.equal(totalDays % 7, 0, `Total days ${totalDays} should be divisible by 7`);
  });
});
