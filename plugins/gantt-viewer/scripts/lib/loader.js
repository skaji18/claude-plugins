import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

const REQUIRED_TASK_FIELDS = ['id', 'name', 'assignee', 'effort', 'start_date', 'end_date', 'progress', 'depends_on', 'group', 'milestone'];
const OPTIONAL_TASK_FIELDS = ['blocked', 'notes', 'tags', 'actual_start_date', 'actual_end_date', 'actual_effort'];
const ALL_TASK_FIELDS = new Set([...REQUIRED_TASK_FIELDS, ...OPTIONAL_TASK_FIELDS]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Check if a YYYY-MM-DD string represents a real calendar date.
 * Assumes the string already matches DATE_PATTERN.
 */
function isRealDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/**
 * Find the closest known field name for a typo suggestion.
 * Uses simple Levenshtein distance.
 */
function findSimilarFields(unknown) {
  const candidates = [];
  for (const known of ALL_TASK_FIELDS) {
    const dist = levenshtein(unknown, known);
    if (dist <= 3) {
      candidates.push({ field: known, dist });
    }
  }
  candidates.sort((a, b) => a.dist - b.dist);
  return candidates.slice(0, 3).map((c) => c.field);
}

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function validateDateValue(dateStr, fieldName, taskId, index) {
  if (!isRealDate(dateStr)) {
    throw new Error(`Task #${index + 1} ("${taskId}"): "${fieldName}" value "${dateStr}" is not a valid calendar date`);
  }
}

function validateTask(task, index) {
  // --- Unknown field detection ---
  for (const key of Object.keys(task)) {
    if (!ALL_TASK_FIELDS.has(key)) {
      const similar = findSimilarFields(key);
      const suggestion = similar.length > 0
        ? ` (typo? similar fields: ${similar.join(', ')})`
        : '';
      throw new Error(`Task #${index + 1}${task.id ? ` ("${task.id}")` : ''}: unknown field "${key}"${suggestion}`);
    }
  }

  for (const field of REQUIRED_TASK_FIELDS) {
    if (task[field] === undefined || task[field] === null) {
      throw new Error(`Task #${index + 1}: required field "${field}" is missing`);
    }
  }

  if (typeof task.id !== 'string' || task.id.length === 0) {
    throw new Error(`Task #${index + 1}: "id" must be a non-empty string`);
  }

  if (typeof task.name !== 'string' || task.name.length === 0) {
    throw new Error(`Task #${index + 1}: "name" must be a non-empty string`);
  }

  if (typeof task.assignee !== 'string') {
    throw new Error(`Task #${index + 1} ("${task.id}"): "assignee" must be a string`);
  }

  if (typeof task.milestone !== 'boolean') {
    throw new Error(`Task #${index + 1} ("${task.id}"): "milestone" must be a boolean`);
  }

  if (task.milestone) {
    if (typeof task.effort !== 'number' || task.effort < 0) {
      throw new Error(`Task #${index + 1} ("${task.id}"): "effort" must be a non-negative number for milestones`);
    }
  } else {
    if (typeof task.effort !== 'number' || task.effort <= 0) {
      throw new Error(`Task #${index + 1} ("${task.id}"): "effort" must be a positive number`);
    }
  }

  if (!DATE_PATTERN.test(task.start_date)) {
    throw new Error(`Task #${index + 1} ("${task.id}"): "start_date" must be YYYY-MM-DD format`);
  }
  validateDateValue(task.start_date, 'start_date', task.id, index);

  if (!DATE_PATTERN.test(task.end_date)) {
    throw new Error(`Task #${index + 1} ("${task.id}"): "end_date" must be YYYY-MM-DD format`);
  }
  validateDateValue(task.end_date, 'end_date', task.id, index);

  if (typeof task.progress !== 'number') {
    throw new Error(`Task #${index + 1} ("${task.id}"): "progress" must be a number`);
  }

  if (task.progress < 0 || task.progress > 100) {
    throw new Error(`Task #${index + 1} ("${task.id}"): "progress" must be between 0 and 100`);
  }

  if (!Array.isArray(task.depends_on)) {
    throw new Error(`Task #${index + 1} ("${task.id}"): "depends_on" must be an array`);
  }

  for (let i = 0; i < task.depends_on.length; i++) {
    if (typeof task.depends_on[i] !== 'string') {
      throw new Error(`Task #${index + 1} ("${task.id}"): "depends_on[${i}]" must be a string`);
    }
  }

  if (typeof task.group !== 'string') {
    throw new Error(`Task #${index + 1} ("${task.id}"): "group" must be a string`);
  }

  // Optional fields
  if (task.blocked !== undefined && typeof task.blocked !== 'boolean') {
    throw new Error(`Task #${index + 1} ("${task.id}"): "blocked" must be a boolean`);
  }

  if (task.notes !== undefined && typeof task.notes !== 'string') {
    throw new Error(`Task #${index + 1} ("${task.id}"): "notes" must be a string`);
  }

  if (task.tags !== undefined) {
    if (!Array.isArray(task.tags) || !task.tags.every((t) => typeof t === 'string')) {
      throw new Error(`Task #${index + 1} ("${task.id}"): "tags" must be an array of strings`);
    }
  }

  if (task.actual_start_date !== undefined) {
    if (!DATE_PATTERN.test(task.actual_start_date)) {
      throw new Error(`Task #${index + 1} ("${task.id}"): "actual_start_date" must be YYYY-MM-DD format`);
    }
    validateDateValue(task.actual_start_date, 'actual_start_date', task.id, index);
  }

  if (task.actual_end_date !== undefined) {
    if (!DATE_PATTERN.test(task.actual_end_date)) {
      throw new Error(`Task #${index + 1} ("${task.id}"): "actual_end_date" must be YYYY-MM-DD format`);
    }
    validateDateValue(task.actual_end_date, 'actual_end_date', task.id, index);
  }

  if (task.actual_effort !== undefined) {
    if (typeof task.actual_effort !== 'number' || task.actual_effort <= 0) {
      throw new Error(`Task #${index + 1} ("${task.id}"): "actual_effort" must be a positive number`);
    }
  }
}

function validateUniqueIds(tasks) {
  const seen = new Set();
  for (const task of tasks) {
    if (seen.has(task.id)) {
      throw new Error(`Duplicate task ID: "${task.id}"`);
    }
    seen.add(task.id);
  }
}

export function loadTasks(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const data = yaml.load(content);

  if (!data || typeof data !== 'object') {
    throw new Error('YAML must contain an object with "project" and "tasks" fields');
  }

  if (!data.project || typeof data.project !== 'object') {
    throw new Error('"project" field is required and must be an object');
  }

  if (!data.project.name) {
    throw new Error('"project.name" is required');
  }

  if (!Array.isArray(data.tasks)) {
    throw new Error('"tasks" field is required and must be an array');
  }

  if (data.tasks.length === 0) {
    throw new Error('"tasks" must contain at least one task');
  }

  // Parse required members/groups sections
  if (!Array.isArray(data.members) || data.members.length === 0 || !data.members.every((m) => typeof m === 'string')) {
    throw new Error('"members" must be a non-empty array of strings');
  }
  const members = data.members;

  if (!Array.isArray(data.groups) || data.groups.length === 0 || !data.groups.every((g) => typeof g === 'string')) {
    throw new Error('"groups" must be a non-empty array of strings');
  }
  const groups = data.groups;

  data.tasks.forEach((task, i) => validateTask(task, i));
  validateUniqueIds(data.tasks);

  // Reference checks against members/groups definitions
  const memberSet = new Set(members);
  for (const task of data.tasks) {
    if (!memberSet.has(task.assignee)) {
      throw new Error(`Task "${task.id}": assignee "${task.assignee}" is not in members list`);
    }
  }

  const groupSet = new Set(groups);
  for (const task of data.tasks) {
    if (!groupSet.has(task.group)) {
      throw new Error(`Task "${task.id}": group "${task.group}" is not in groups list`);
    }
  }

  return { project: data.project, tasks: data.tasks, members, groups };
}
