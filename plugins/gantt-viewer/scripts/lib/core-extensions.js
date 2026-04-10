/**
 * core-extensions.js — ESM wrapper for new gantt-core functions (Node.js test compatible)
 */

const MS_PER_DAY = 86400000;

function parseDate(str) {
  return new Date(str + 'T00:00:00');
}

function daysBetween(d1, d2) {
  return Math.round((d2.getTime() - d1.getTime()) / MS_PER_DAY);
}

/**
 * Returns a Set of task IDs that are delayed (end_date <= today AND progress < 100).
 */
export function getDelayedTasks(tasks, today) {
  const todayDate = parseDate(today);
  const delayed = new Set();
  for (const t of tasks) {
    const endDate = parseDate(t.end_date);
    if (endDate <= todayDate && t.progress < 100) {
      delayed.add(t.id);
    }
  }
  return delayed;
}

/**
 * Calculate summary: {overallProgress, delayedCount, criticalDays}
 */
export function calculateSummary(tasks, criticalPath, today) {
  if (tasks.length === 0) {
    return { overallProgress: 0, delayedCount: 0, criticalDays: 0 };
  }

  const totalProgress = tasks.reduce((sum, t) => sum + t.progress, 0);
  const overallProgress = Math.round(totalProgress / tasks.length);

  const delayed = getDelayedTasks(tasks, today);
  const delayedCount = delayed.size;

  // criticalDays = days from today to the last end_date among CP tasks
  let criticalDays = 0;
  if (criticalPath.path.size > 0) {
    const todayDate = parseDate(today);
    let maxEnd = null;
    for (const t of tasks) {
      if (criticalPath.path.has(t.id)) {
        const endDate = parseDate(t.end_date);
        if (maxEnd === null || endDate > maxEnd) {
          maxEnd = endDate;
        }
      }
    }
    if (maxEnd !== null) {
      criticalDays = daysBetween(todayDate, maxEnd);
    }
  }

  return { overallProgress, delayedCount, criticalDays };
}

/**
 * Filter tasks by criteria (AND logic). Returns Set of matching task IDs.
 * filter: { assignee?, group?, delayedOnly?, criticalOnly? }
 * context: { today, criticalPath (Set of task IDs) }
 */
export function filterTasks(tasks, filter, context = {}) {
  const { today, criticalPath } = context;
  const delayed = today ? getDelayedTasks(tasks, today) : new Set();

  const result = new Set();
  for (const t of tasks) {
    let match = true;

    if (filter.assignee && t.assignee !== filter.assignee) {
      match = false;
    }
    if (filter.group && t.group !== filter.group) {
      match = false;
    }
    if (filter.delayedOnly && !delayed.has(t.id)) {
      match = false;
    }
    if (filter.criticalOnly && criticalPath && !criticalPath.has(t.id)) {
      match = false;
    }

    if (match) {
      result.add(t.id);
    }
  }
  return result;
}

/**
 * Assign HSL colors to unique assignees. Returns Map<assignee, {bar, light}>
 */
export function assignColors(tasks) {
  const assignees = [...new Set(tasks.map(t => t.assignee))];
  const colorMap = new Map();
  const count = assignees.length;

  for (let i = 0; i < count; i++) {
    const hue = Math.round((360 / count) * i);
    colorMap.set(assignees[i], {
      bar: `hsl(${hue}, 70%, 50%)`,
      light: `hsl(${hue}, 70%, 90%)`,
    });
  }

  return colorMap;
}

/**
 * Returns Map<taskId, daysLeft> for milestone tasks only.
 */
export function milestoneDaysLeft(tasks, today) {
  const todayDate = parseDate(today);
  const result = new Map();
  for (const t of tasks) {
    if (t.milestone) {
      const endDate = parseDate(t.end_date);
      result.set(t.id, daysBetween(todayDate, endDate));
    }
  }
  return result;
}

/**
 * Returns Map<assignee, [{taskId, start_date, end_date}]>
 */
export function calculateAssigneeLoad(tasks) {
  const result = new Map();
  for (const t of tasks) {
    if (!result.has(t.assignee)) {
      result.set(t.assignee, []);
    }
    result.get(t.assignee).push({
      taskId: t.id,
      start_date: t.start_date,
      end_date: t.end_date,
    });
  }
  return result;
}
