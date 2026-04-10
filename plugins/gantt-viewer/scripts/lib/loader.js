import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';

const REQUIRED_TASK_FIELDS = ['id', 'name', 'assignee', 'effort', 'start_date', 'end_date', 'progress', 'depends_on', 'group', 'milestone'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validateTask(task, index) {
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

  if (typeof task.effort !== 'number' || task.effort <= 0) {
    throw new Error(`Task #${index + 1} ("${task.id}"): "effort" must be a positive number`);
  }

  if (!DATE_PATTERN.test(task.start_date)) {
    throw new Error(`Task #${index + 1} ("${task.id}"): "start_date" must be YYYY-MM-DD format`);
  }

  if (!DATE_PATTERN.test(task.end_date)) {
    throw new Error(`Task #${index + 1} ("${task.id}"): "end_date" must be YYYY-MM-DD format`);
  }

  if (typeof task.progress !== 'number') {
    throw new Error(`Task #${index + 1} ("${task.id}"): "progress" must be a number`);
  }

  if (task.progress < 0 || task.progress > 100) {
    throw new Error(`Task #${index + 1} ("${task.id}"): "progress" must be between 0 and 100`);
  }

  if (!Array.isArray(task.depends_on)) {
    throw new Error(`Task #${index + 1} ("${task.id}"): "depends_on" must be an array`);
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

  if (task.actual_start_date !== undefined && !DATE_PATTERN.test(task.actual_start_date)) {
    throw new Error(`Task #${index + 1} ("${task.id}"): "actual_start_date" must be YYYY-MM-DD format`);
  }

  if (task.actual_end_date !== undefined && !DATE_PATTERN.test(task.actual_end_date)) {
    throw new Error(`Task #${index + 1} ("${task.id}"): "actual_end_date" must be YYYY-MM-DD format`);
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

  // Parse optional members/groups sections
  let members = null;
  if (data.members !== undefined) {
    if (!Array.isArray(data.members) || !data.members.every((m) => typeof m === 'string')) {
      throw new Error('"members" must be an array of strings');
    }
    members = data.members;
  }

  let groups = null;
  if (data.groups !== undefined) {
    if (!Array.isArray(data.groups) || !data.groups.every((g) => typeof g === 'string')) {
      throw new Error('"groups" must be an array of strings');
    }
    groups = data.groups;
  }

  data.tasks.forEach((task, i) => validateTask(task, i));
  validateUniqueIds(data.tasks);

  // Reference checks against members/groups definitions
  if (members) {
    const memberSet = new Set(members);
    for (const task of data.tasks) {
      if (!memberSet.has(task.assignee)) {
        throw new Error(`Task "${task.id}": assignee "${task.assignee}" is not in members list`);
      }
    }
  }

  if (groups) {
    const groupSet = new Set(groups);
    for (const task of data.tasks) {
      if (!groupSet.has(task.group)) {
        throw new Error(`Task "${task.id}": group "${task.group}" is not in groups list`);
      }
    }
  }

  return { project: data.project, tasks: data.tasks, members, groups };
}
