function buildTaskMap(tasks) {
  const map = new Map();
  for (const task of tasks) {
    map.set(task.id, task);
  }
  return map;
}

export function checkDependencyViolations(tasks) {
  const taskMap = buildTaskMap(tasks);
  const results = [];

  for (const task of tasks) {
    for (const depId of task.depends_on) {
      const dep = taskMap.get(depId);
      if (!dep) continue;
      if (task.start_date <= dep.end_date) {
        results.push({
          level: 'ERROR',
          type: 'dependency_violation',
          taskId: task.id,
          message: `"${task.id}" (開始: ${task.start_date}) は依存先 "${depId}" (終了: ${dep.end_date}) より前に開始`,
        });
      }
    }
  }

  return results;
}

export function checkDateContradictions(tasks) {
  const results = [];

  for (const task of tasks) {
    if (task.start_date > task.end_date) {
      results.push({
        level: 'ERROR',
        type: 'date_contradiction',
        taskId: task.id,
        message: `"${task.id}" の start_date (${task.start_date}) > end_date (${task.end_date})`,
      });
    }
  }

  return results;
}

export function checkInvalidReferences(tasks) {
  const validIds = new Set(tasks.map((t) => t.id));
  const results = [];

  for (const task of tasks) {
    for (const depId of task.depends_on) {
      if (!validIds.has(depId)) {
        results.push({
          level: 'ERROR',
          type: 'invalid_reference',
          taskId: task.id,
          message: `"${task.id}" が存在しない ID "${depId}" に依存`,
        });
      }
    }
  }

  return results;
}

export function checkCircularDependencies(tasks) {
  const results = [];
  const taskMap = new Map();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  const visited = new Set();
  const inStack = new Set();

  function dfs(id, path) {
    if (inStack.has(id)) {
      const cycleStart = path.indexOf(id);
      const cycle = path.slice(cycleStart).concat(id);
      results.push({
        level: 'ERROR',
        type: 'circular_dependency',
        taskId: id,
        message: `循環依存を検出: ${cycle.join(' → ')}`,
      });
      return;
    }
    if (visited.has(id)) return;

    visited.add(id);
    inStack.add(id);
    path.push(id);

    const task = taskMap.get(id);
    if (task) {
      for (const depId of task.depends_on) {
        if (taskMap.has(depId)) {
          dfs(depId, path);
        }
      }
    }

    path.pop();
    inStack.delete(id);
  }

  for (const task of tasks) {
    if (!visited.has(task.id)) {
      dfs(task.id, []);
    }
  }

  return results;
}

export function checkDelayedTasks(tasks, today) {
  const results = [];

  for (const task of tasks) {
    if (task.end_date < today && task.progress < 100) {
      results.push({
        level: 'WARN',
        type: 'delayed',
        taskId: task.id,
        message: `"${task.id}" の end_date (${task.end_date}) は今日 (${today}) より前`,
      });
    }
  }

  return results;
}

export function checkStatusContradictions(tasks) {
  const results = [];

  for (const task of tasks) {
    if (task.actual_end_date && task.progress < 100) {
      results.push({
        level: 'ERROR',
        type: 'status_contradiction',
        taskId: task.id,
        message: `"${task.id}" は actual_end_date (${task.actual_end_date}) が設定済みだが progress が ${task.progress}（100 未満）`,
      });
    }
  }

  return results;
}

export function checkActualDateConsistency(tasks) {
  const results = [];

  for (const task of tasks) {
    if (task.actual_start_date && task.actual_end_date && task.actual_start_date > task.actual_end_date) {
      results.push({
        level: 'ERROR',
        type: 'actual_date_contradiction',
        taskId: task.id,
        message: `"${task.id}" の actual_start_date (${task.actual_start_date}) > actual_end_date (${task.actual_end_date})`,
      });
    }

    if (task.actual_end_date && !task.actual_start_date) {
      results.push({
        level: 'WARN',
        type: 'actual_date_incomplete',
        taskId: task.id,
        message: `"${task.id}" は actual_end_date (${task.actual_end_date}) があるが actual_start_date が未設定`,
      });
    }
  }

  return results;
}

export function runAllChecks(tasks, today) {
  return [
    ...checkCircularDependencies(tasks),
    ...checkDependencyViolations(tasks),
    ...checkDateContradictions(tasks),
    ...checkInvalidReferences(tasks),
    ...checkDelayedTasks(tasks, today),
    ...checkStatusContradictions(tasks),
    ...checkActualDateConsistency(tasks),
  ];
}
