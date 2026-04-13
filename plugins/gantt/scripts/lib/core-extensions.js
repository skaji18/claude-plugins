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

  let weightedSum = 0;
  let totalDuration = 0;
  for (const t of tasks) {
    const duration = daysBetween(parseDate(t.start_date), parseDate(t.end_date));
    weightedSum += duration * t.progress;
    totalDuration += duration;
  }
  const overallProgress = totalDuration > 0 ? Math.round(weightedSum / totalDuration) : 0;

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
 * filter: { assignee?, group?, project?, delayedOnly?, criticalOnly? }
 * context: { today, criticalPath (Set of task IDs) }
 */
export function filterTasks(tasks, filter, context = {}) {
  const { today, criticalPath } = context;
  const delayed = today ? getDelayedTasks(tasks, today) : new Set();

  const result = new Set();
  for (const t of tasks) {
    let match = true;

    if (filter.project && t.project !== filter.project) {
      match = false;
    }
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
 * Group tasks by project, then by group within each project.
 * Returns: [{project: string, groups: [{name: string|null, tasks: Task[]}]}]
 * Tasks without a group are placed in a null-name group.
 * Insertion order of projects and groups is preserved.
 */
export function groupTasksByProject(tasks) {
  const projects = [];
  const projectMap = new Map();

  for (const t of tasks) {
    const projectName = t.project;
    const groupName = t.group !== undefined ? t.group : null;

    if (!projectMap.has(projectName)) {
      const entry = { project: projectName, groups: [], groupMap: new Map() };
      projectMap.set(projectName, entry);
      projects.push(entry);
    }

    const proj = projectMap.get(projectName);
    if (!proj.groupMap.has(groupName)) {
      const groupEntry = { name: groupName, tasks: [] };
      proj.groupMap.set(groupName, groupEntry);
      proj.groups.push(groupEntry);
    }

    proj.groupMap.get(groupName).tasks.push(t);
  }

  return projects.map((p) => ({ project: p.project, groups: p.groups }));
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
 * Extend getDateRange to align boundaries to the given display mode.
 * - 'week': start snaps to Monday, end snaps to Sunday
 * - 'month' / 'day': default month-aligned range (startOfMonth..endOfMonth)
 */
export function getDateRangeForMode(tasks, mode) {
  // Base range: startOfMonth(min) .. endOfMonth(max)
  let min = parseDate(tasks[0].start_date);
  let max = parseDate(tasks[0].end_date);
  for (const t of tasks) {
    const s = parseDate(t.start_date);
    const e = parseDate(t.end_date);
    if (s < min) min = s;
    if (e > max) max = e;
  }
  const start = new Date(min.getFullYear(), min.getMonth(), 1);
  const end = new Date(max.getFullYear(), max.getMonth() + 1, 0);

  if (mode === 'week') {
    // Snap start to Monday
    const startDow = start.getDay();
    const startDiff = startDow === 0 ? 6 : startDow - 1;
    const weekStart = addDays(start, -startDiff);
    // Snap end to Sunday
    const endDow = end.getDay();
    const endDiff = endDow === 0 ? 0 : 7 - endDow;
    const weekEnd = addDays(end, endDiff);
    return { start: weekStart, end: weekEnd };
  }
  return { start, end };
}

function addDays(date, n) {
  return new Date(date.getTime() + n * MS_PER_DAY);
}

/**
 * Returns Map<assignee, [{taskId, name, start_date, end_date}]>
 */
export function calculateAssigneeLoad(tasks) {
  const result = new Map();
  for (const t of tasks) {
    if (!result.has(t.assignee)) {
      result.set(t.assignee, []);
    }
    result.get(t.assignee).push({
      taskId: t.id,
      name: t.name,
      start_date: t.start_date,
      end_date: t.end_date,
      effort: t.effort != null ? t.effort : null,
    });
  }
  return result;
}

/**
 * Pack tasks into sub-rows using greedy algorithm.
 * Tasks that don't overlap share a sub-row; overlapping tasks get new sub-rows.
 * Returns array of sub-rows, each an array of task entries.
 */
export function packSubRows(entries) {
  const sorted = entries.slice().sort((a, b) => {
    if (a.start_date !== b.start_date) return a.start_date < b.start_date ? -1 : 1;
    return a.end_date < b.end_date ? -1 : 1;
  });
  const subRows = [];
  for (const entry of sorted) {
    let placed = false;
    for (let i = 0; i < subRows.length; i++) {
      if (entry.start_date > subRows[i].lastEnd) {
        subRows[i].tasks.push(entry);
        subRows[i].lastEnd = entry.end_date;
        placed = true;
        break;
      }
    }
    if (!placed) {
      subRows.push({ tasks: [entry], lastEnd: entry.end_date });
    }
  }
  return subRows.map(r => r.tasks);
}
