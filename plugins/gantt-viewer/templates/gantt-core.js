/* global jsyaml */
'use strict';

const GanttCore = (() => {
  const MS_PER_DAY = 86400000;

  function parseDate(str) {
    return new Date(str + 'T00:00:00');
  }

  function daysBetween(d1, d2) {
    return Math.round((d2.getTime() - d1.getTime()) / MS_PER_DAY);
  }

  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function addDays(date, n) {
    return new Date(date.getTime() + n * MS_PER_DAY);
  }

  async function loadYaml(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    const text = await res.text();
    return jsyaml.load(text);
  }

  function topologicalSort(tasks) {
    const taskMap = new Map();
    const inDegree = new Map();
    const adj = new Map();

    for (const t of tasks) {
      taskMap.set(t.id, t);
      inDegree.set(t.id, 0);
      adj.set(t.id, []);
    }

    for (const t of tasks) {
      for (const dep of t.depends_on) {
        if (!taskMap.has(dep)) continue;
        adj.get(dep).push(t.id);
        inDegree.set(t.id, inDegree.get(t.id) + 1);
      }
    }

    const queue = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const sorted = [];
    while (queue.length > 0) {
      const id = queue.shift();
      sorted.push(id);
      for (const nb of adj.get(id)) {
        const nd = inDegree.get(nb) - 1;
        inDegree.set(nb, nd);
        if (nd === 0) queue.push(nb);
      }
    }

    if (sorted.length !== tasks.length) {
      throw new Error('Circular dependency detected');
    }
    return sorted;
  }

  function calculateCriticalPath(tasks) {
    const sorted = topologicalSort(tasks);
    const taskMap = new Map();
    for (const t of tasks) taskMap.set(t.id, t);

    const dist = new Map();
    const prev = new Map();

    for (const id of sorted) {
      const t = taskMap.get(id);
      const start = parseDate(t.start_date);
      const end = parseDate(t.end_date);
      const duration = daysBetween(start, end) + 1;

      let maxPrev = 0;
      let maxPrevId = null;
      for (const dep of t.depends_on) {
        if (!dist.has(dep)) continue;
        if (dist.get(dep) > maxPrev) {
          maxPrev = dist.get(dep);
          maxPrevId = dep;
        }
      }

      dist.set(id, maxPrev + duration);
      prev.set(id, maxPrevId);
    }

    let endId = null;
    let maxDist = 0;
    for (const [id, d] of dist) {
      if (d > maxDist) {
        maxDist = d;
        endId = id;
      }
    }

    const path = [];
    let cur = endId;
    while (cur !== null) {
      path.unshift(cur);
      cur = prev.get(cur);
    }

    return { path: new Set(path), orderedPath: path, totalDays: maxDist };
  }

  function checkViolations(tasks) {
    const taskMap = new Map();
    for (const t of tasks) taskMap.set(t.id, t);
    const violations = new Set();

    for (const t of tasks) {
      if (t.start_date > t.end_date) {
        violations.add(t.id);
        continue;
      }
      for (const dep of t.depends_on) {
        const d = taskMap.get(dep);
        if (!d) { violations.add(t.id); continue; }
        if (t.start_date <= d.end_date) violations.add(t.id);
      }
    }

    return violations;
  }

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(date) {
    // Day 0 of next month = last day of current month
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function getDateRange(tasks) {
    let min = parseDate(tasks[0].start_date);
    let max = parseDate(tasks[0].end_date);
    for (const t of tasks) {
      const s = parseDate(t.start_date);
      const e = parseDate(t.end_date);
      if (s < min) min = s;
      if (e > max) max = e;
    }
    return { start: startOfMonth(min), end: endOfMonth(max) };
  }

  function startOfWeek(date) {
    // Monday as start of week (getDay: 0=Sun, 1=Mon, ..., 6=Sat)
    const d = new Date(date);
    const dow = d.getDay();
    const diff = dow === 0 ? 6 : dow - 1; // days since Monday
    return addDays(d, -diff);
  }

  function endOfWeek(date) {
    // Sunday as end of week
    const d = new Date(date);
    const dow = d.getDay();
    const diff = dow === 0 ? 0 : 7 - dow; // days until Sunday
    return addDays(d, diff);
  }

  function getDateRangeForMode(tasks, mode) {
    const base = getDateRange(tasks);
    if (mode === 'week') {
      return { start: startOfWeek(base.start), end: endOfWeek(base.end) };
    }
    return base;
  }

  function groupTasks(tasks) {
    const groups = [];
    const groupMap = new Map();

    for (const t of tasks) {
      const g = t.group;
      if (!groupMap.has(g)) {
        const entry = { name: g, tasks: [] };
        groupMap.set(g, entry);
        groups.push(entry);
      }
      groupMap.get(g).tasks.push(t);
    }

    return groups;
  }

  function getDelayedTasks(tasks, today) {
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

  function calculateSummary(tasks, criticalPath, today) {
    if (tasks.length === 0) {
      return { overallProgress: 0, delayedCount: 0, criticalDays: 0 };
    }
    const totalProgress = tasks.reduce((sum, t) => sum + t.progress, 0);
    const overallProgress = Math.round(totalProgress / tasks.length);
    const delayed = getDelayedTasks(tasks, today);
    const delayedCount = delayed.size;

    let criticalDays = 0;
    if (criticalPath.path.size > 0) {
      const todayDate = parseDate(today);
      let maxEnd = null;
      for (const t of tasks) {
        if (criticalPath.path.has(t.id)) {
          const endDate = parseDate(t.end_date);
          if (maxEnd === null || endDate > maxEnd) maxEnd = endDate;
        }
      }
      if (maxEnd !== null) criticalDays = daysBetween(todayDate, maxEnd);
    }
    return { overallProgress, delayedCount, criticalDays };
  }

  function filterTasks(tasks, filter, context) {
    context = context || {};
    const delayed = context.today ? getDelayedTasks(tasks, context.today) : new Set();
    const criticalPath = context.criticalPath || new Set();
    const result = new Set();
    for (const t of tasks) {
      let match = true;
      if (filter.assignee && t.assignee !== filter.assignee) match = false;
      if (filter.group && t.group !== filter.group) match = false;
      if (filter.delayedOnly && !delayed.has(t.id)) match = false;
      if (filter.criticalOnly && !criticalPath.has(t.id)) match = false;
      if (match) result.add(t.id);
    }
    return result;
  }

  function assignColors(tasks) {
    const assignees = [];
    const seen = new Set();
    for (const t of tasks) {
      if (!seen.has(t.assignee)) { seen.add(t.assignee); assignees.push(t.assignee); }
    }
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

  function milestoneDaysLeft(tasks, today) {
    const todayDate = parseDate(today);
    const result = new Map();
    for (const t of tasks) {
      if (t.milestone) {
        result.set(t.id, daysBetween(todayDate, parseDate(t.end_date)));
      }
    }
    return result;
  }

  function calculateAssigneeLoad(tasks) {
    const result = new Map();
    for (const t of tasks) {
      if (!result.has(t.assignee)) result.set(t.assignee, []);
      result.get(t.assignee).push({ taskId: t.id, start_date: t.start_date, end_date: t.end_date });
    }
    return result;
  }

  return {
    parseDate,
    daysBetween,
    formatDate,
    addDays,
    loadYaml,
    calculateCriticalPath,
    checkViolations,
    getDateRange,
    getDateRangeForMode,
    groupTasks,
    getDelayedTasks,
    calculateSummary,
    filterTasks,
    assignColors,
    milestoneDaysLeft,
    calculateAssigneeLoad,
  };
})();
