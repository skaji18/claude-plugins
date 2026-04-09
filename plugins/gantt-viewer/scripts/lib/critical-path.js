const MS_PER_DAY = 86400000;

function taskDuration(task) {
  const start = new Date(task.start_date).getTime();
  const end = new Date(task.end_date).getTime();
  return (end - start) / MS_PER_DAY + 1;
}

function topologicalSort(tasks) {
  const taskMap = new Map();
  const inDegree = new Map();
  const adjacency = new Map();

  for (const task of tasks) {
    taskMap.set(task.id, task);
    inDegree.set(task.id, 0);
    adjacency.set(task.id, []);
  }

  for (const task of tasks) {
    for (const depId of task.depends_on) {
      if (!taskMap.has(depId)) continue;
      adjacency.get(depId).push(task.id);
      inDegree.set(task.id, inDegree.get(task.id) + 1);
    }
  }

  const queue = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted = [];
  while (queue.length > 0) {
    const id = queue.shift();
    sorted.push(id);
    for (const neighbor of adjacency.get(id)) {
      const newDegree = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== tasks.length) {
    throw new Error('Circular dependency detected');
  }

  return sorted;
}

export function calculateCriticalPath(tasks) {
  const sorted = topologicalSort(tasks);
  const taskMap = new Map();
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  const dist = new Map();
  const prev = new Map();

  for (const id of sorted) {
    const task = taskMap.get(id);
    const duration = taskDuration(task);
    let maxPrev = 0;
    let maxPrevId = null;

    for (const depId of task.depends_on) {
      if (!dist.has(depId)) continue;
      if (dist.get(depId) > maxPrev) {
        maxPrev = dist.get(depId);
        maxPrevId = depId;
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
  let current = endId;
  while (current !== null) {
    path.unshift(current);
    current = prev.get(current);
  }

  return { path, totalDays: maxDist };
}
