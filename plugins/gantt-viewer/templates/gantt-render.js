/* global GanttCore */
'use strict';

const GanttRender = (() => {
  let state = null;

  const COL_WIDTH_DAY = 32;
  const COL_WIDTH_WEEK = 100;

  function getColWidth() {
    return state.mode === 'week' ? COL_WIDTH_WEEK : COL_WIDTH_DAY;
  }

  function buildRows() {
    const groups = GanttCore.groupTasks(state.tasks);
    const rows = [];
    for (const g of groups) {
      rows.push({ type: 'group', name: g.name, id: `group-${g.name}` });
      for (const t of g.tasks) {
        rows.push({ type: 'task', task: t, groupName: g.name });
      }
    }
    return rows;
  }

  function renderSidebar() {
    const container = document.getElementById('sidebar-rows');
    container.innerHTML = '';
    for (const row of state.rows) {
      const div = document.createElement('div');
      if (row.type === 'group') {
        div.className = 'sidebar-group';
        if (state.collapsed.has(row.name)) div.classList.add('collapsed');
        div.textContent = row.name;
        div.addEventListener('click', () => toggleGroup(row.name));
      } else {
        div.className = 'sidebar-row';
        if (state.collapsed.has(row.groupName)) div.classList.add('hidden');
        if (state.violations.has(row.task.id)) div.classList.add('warning');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'task-name';
        nameSpan.textContent = row.task.name;
        div.appendChild(nameSpan);
        const assigneeSpan = document.createElement('span');
        assigneeSpan.className = 'task-assignee';
        assigneeSpan.textContent = row.task.assignee;
        div.appendChild(assigneeSpan);
      }
      container.appendChild(div);
    }
  }

  function renderTimelineHeader() {
    const header = document.getElementById('timeline-header');
    header.innerHTML = '';
    const range = state.dateRange;
    const colW = getColWidth();
    const totalDays = GanttCore.daysBetween(range.start, range.end);

    if (state.mode === 'week') {
      let d = new Date(range.start);
      const dow = d.getDay();
      if (dow !== 1) d = GanttCore.addDays(d, (8 - dow) % 7);
      let x = GanttCore.daysBetween(range.start, d) * (colW / 7);
      while (d <= range.end) {
        const cell = document.createElement('div');
        cell.className = 'header-cell';
        cell.style.left = x + 'px';
        cell.style.width = colW + 'px';
        cell.textContent = GanttCore.formatDate(d);
        header.appendChild(cell);
        d = GanttCore.addDays(d, 7);
        x += colW;
      }
    } else {
      for (let i = 0; i <= totalDays; i++) {
        const d = GanttCore.addDays(range.start, i);
        const cell = document.createElement('div');
        cell.className = 'header-cell';
        cell.style.left = (i * colW) + 'px';
        cell.style.width = colW + 'px';
        cell.textContent = `${d.getMonth() + 1}/${d.getDate()}`;
        header.appendChild(cell);
      }
    }
    header.style.width = totalDays * colW + 'px';
  }

  function dayToX(date) {
    return GanttCore.daysBetween(state.dateRange.start, date) * getColWidth();
  }

  function renderTimelineBody() {
    const body = document.getElementById('timeline-body');
    body.innerHTML = '';
    const colW = getColWidth();
    const totalDays = GanttCore.daysBetween(state.dateRange.start, state.dateRange.end);
    body.style.width = totalDays * colW + 'px';

    for (let i = 0; i <= totalDays; i++) {
      const line = document.createElement('div');
      line.className = 'grid-line';
      line.style.left = (i * colW) + 'px';
      body.appendChild(line);
    }

    state.taskPositions = new Map();
    let rowIdx = 0;

    for (const row of state.rows) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'timeline-row';

      if (row.type === 'group') {
        rowDiv.classList.add('group-row');
      } else {
        const isHidden = state.collapsed.has(row.groupName);
        if (isHidden) rowDiv.classList.add('hidden');
        const t = row.task;
        const startX = dayToX(GanttCore.parseDate(t.start_date));
        const endX = dayToX(GanttCore.parseDate(t.end_date)) + colW;

        if (t.milestone) {
          const marker = document.createElement('div');
          marker.className = 'milestone-marker';
          marker.style.left = (startX + (colW - 16) / 2) + 'px';
          rowDiv.appendChild(marker);
        } else {
          const bar = document.createElement('div');
          bar.className = 'task-bar';
          if (state.criticalPath.has(t.id)) bar.classList.add('critical');
          if (state.violations.has(t.id)) bar.classList.add('warning');
          bar.style.left = startX + 'px';
          bar.style.width = (endX - startX) + 'px';

          if (t.progress > 0) {
            const fill = document.createElement('div');
            fill.className = 'progress-fill';
            fill.style.width = t.progress + '%';
            bar.appendChild(fill);
          }
          rowDiv.appendChild(bar);
        }

        if (!isHidden) {
          const midY = rowIdx * 36 + 18;
          state.taskPositions.set(t.id, { startX, endX, midY });
        }
      }
      body.appendChild(rowDiv);
      const isVisible = row.type === 'group' || !state.collapsed.has(row.groupName);
      if (isVisible) rowIdx++;
    }

    renderTodayLine(body);
    renderArrows(body);
  }

  function renderTodayLine(body) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today < state.dateRange.start || today > state.dateRange.end) return;

    const x = dayToX(today) + getColWidth() / 2;
    const line = document.createElement('div');
    line.className = 'today-line';
    line.style.left = x + 'px';
    body.appendChild(line);

    const label = document.createElement('div');
    label.className = 'today-label';
    label.style.left = x + 'px';
    label.textContent = 'Today';
    body.appendChild(label);
  }

  function renderArrows(body) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('arrows');
    svg.style.width = body.style.width;
    svg.style.height = body.offsetHeight + 'px';

    for (const row of state.rows) {
      if (row.type !== 'task') continue;
      const t = row.task;
      const toPos = state.taskPositions.get(t.id);
      if (!toPos) continue;

      for (const depId of t.depends_on) {
        const fromPos = state.taskPositions.get(depId);
        if (!fromPos) continue;

        const x1 = fromPos.endX;
        const y1 = fromPos.midY;
        const x2 = toPos.startX;
        const y2 = toPos.midY;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2 - 6);
        line.setAttribute('y2', y2);
        svg.appendChild(line);

        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points', `${x2},${y2} ${x2 - 6},${y2 - 4} ${x2 - 6},${y2 + 4}`);
        svg.appendChild(arrow);
      }
    }
    body.appendChild(svg);
  }

  function toggleGroup(name) {
    if (state.collapsed.has(name)) {
      state.collapsed.delete(name);
    } else {
      state.collapsed.add(name);
    }
    render();
  }

  function setMode(mode) {
    state.mode = mode;
    document.getElementById('btn-day').classList.toggle('active', mode === 'day');
    document.getElementById('btn-week').classList.toggle('active', mode === 'week');
    render();
  }

  function render() {
    state.rows = buildRows();
    renderSidebar();
    renderTimelineHeader();
    renderTimelineBody();
  }

  async function init(yamlUrl) {
    const data = await GanttCore.loadYaml(yamlUrl);
    document.getElementById('project-name').textContent = data.project.name;

    let cp;
    try {
      cp = GanttCore.calculateCriticalPath(data.tasks);
    } catch (err) {
      console.error('Critical path calculation failed:', err.message);
      cp = { path: new Set(), orderedPath: [], totalDays: 0 };
    }

    state = {
      tasks: data.tasks,
      dateRange: GanttCore.getDateRange(data.tasks),
      criticalPath: cp.path,
      violations: GanttCore.checkViolations(data.tasks),
      mode: 'day',
      collapsed: new Set(),
      rows: [],
      taskPositions: new Map(),
    };

    document.getElementById('btn-day').addEventListener('click', () => setMode('day'));
    document.getElementById('btn-week').addEventListener('click', () => setMode('week'));

    render();
  }

  return { init };
})();
