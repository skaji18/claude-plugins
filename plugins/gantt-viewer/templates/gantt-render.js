/* global GanttCore, GanttUI */
'use strict';

const GanttRender = (() => {
  let state = null;

  const COL_WIDTH_DAY = 32;
  const COL_WIDTH_WEEK = 100;
  const COL_WIDTH_MONTH = 6;

  const GROUP_COLORS = [
    'hsl(210, 70%, 50%)',
    'hsl(150, 70%, 40%)',
    'hsl(30, 80%, 50%)',
    'hsl(330, 70%, 50%)',
    'hsl(270, 60%, 50%)',
  ];

  function getColWidth() {
    if (state.mode === 'week') return COL_WIDTH_WEEK;
    if (state.mode === 'month') return COL_WIDTH_MONTH;
    return COL_WIDTH_DAY;
  }

  function buildRows() {
    const groups = GanttCore.groupTasks(state.tasks);
    const rows = [];
    for (let gi = 0; gi < groups.length; gi++) {
      const g = groups[gi];
      rows.push({ type: 'group', name: g.name, id: `group-${g.name}`, groupIndex: gi });
      for (const t of g.tasks) {
        rows.push({ type: 'task', task: t, groupName: g.name, groupIndex: gi });
      }
    }
    return rows;
  }

  function getTodayStr() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return GanttCore.formatDate(d);
  }

  function renderSidebar() {
    const container = document.getElementById('sidebar-rows');
    container.innerHTML = '';
    for (const row of state.rows) {
      const div = document.createElement('div');
      if (row.type === 'group') {
        div.className = 'sidebar-group';
        const colorIdx = row.groupIndex % GROUP_COLORS.length;
        div.classList.add('group-color-' + colorIdx);
        if (state.collapsed.has(row.name)) div.classList.add('collapsed');
        div.textContent = row.name;
        div.addEventListener('click', () => toggleGroup(row.name));
      } else {
        div.className = 'sidebar-row';
        if (state.collapsed.has(row.groupName)) div.classList.add('hidden');
        if (state.violations.has(row.task.id)) div.classList.add('warning');
        if (state.delayed.has(row.task.id)) div.classList.add('delayed');
        if (state.filteredTasks && !state.filteredTasks.has(row.task.id)) div.classList.add('filtered-out');

        div.dataset.taskId = row.task.id;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'task-name';
        nameSpan.textContent = row.task.name;
        div.appendChild(nameSpan);

        const assigneeSpan = document.createElement('span');
        assigneeSpan.className = 'task-assignee';
        assigneeSpan.textContent = row.task.assignee;
        div.appendChild(assigneeSpan);

        // Milestone remaining days badge
        if (row.task.milestone && state.milestoneDays.has(row.task.id)) {
          const badge = document.createElement('span');
          badge.className = 'milestone-badge';
          const days = state.milestoneDays.get(row.task.id);
          badge.textContent = days >= 0 ? `${days}日` : `${Math.abs(days)}日超過`;
          div.appendChild(badge);
        }
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
    } else if (state.mode === 'month') {
      // Month header: show month labels
      let prevMonth = -1;
      for (let i = 0; i <= totalDays; i++) {
        const d = GanttCore.addDays(range.start, i);
        const m = d.getMonth();
        if (m !== prevMonth) {
          const cell = document.createElement('div');
          cell.className = 'header-cell';
          cell.style.left = (i * colW) + 'px';
          // Calculate width as days in this month visible
          let daysInMonth = 1;
          for (let j = i + 1; j <= totalDays; j++) {
            const nd = GanttCore.addDays(range.start, j);
            if (nd.getMonth() !== m) break;
            daysInMonth++;
          }
          cell.style.width = (daysInMonth * colW) + 'px';
          cell.textContent = `${d.getFullYear()}/${m + 1}`;
          header.appendChild(cell);
          prevMonth = m;
        }
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

  function getRowHeight() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--row-height')) || 36;
  }

  function renderTimelineBody() {
    const body = document.getElementById('timeline-body');
    body.innerHTML = '';
    const colW = getColWidth();
    const rowH = getRowHeight();
    const totalDays = GanttCore.daysBetween(state.dateRange.start, state.dateRange.end);
    body.style.width = totalDays * colW + 'px';

    // Grid lines and weekend backgrounds
    for (let i = 0; i <= totalDays; i++) {
      const d = GanttCore.addDays(state.dateRange.start, i);
      const dow = d.getDay();

      const line = document.createElement('div');
      line.className = 'grid-line';
      line.style.left = (i * colW) + 'px';
      body.appendChild(line);

      // Weekend highlight (Saturday = 6, Sunday = 0)
      if (dow === 0 || dow === 6) {
        const we = document.createElement('div');
        we.className = 'weekend-col';
        we.style.left = (i * colW) + 'px';
        we.style.width = colW + 'px';
        body.appendChild(we);
      }
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
        if (state.filteredTasks && !state.filteredTasks.has(row.task.id)) rowDiv.classList.add('filtered-out');

        rowDiv.dataset.taskId = row.task.id;
        const t = row.task;
        const startX = dayToX(GanttCore.parseDate(t.start_date));
        const endX = dayToX(GanttCore.parseDate(t.end_date)) + colW;

        if (t.milestone) {
          const marker = document.createElement('div');
          marker.className = 'milestone-marker';
          marker.style.left = (startX + (colW - 16) / 2) + 'px';
          marker.dataset.taskId = t.id;
          rowDiv.appendChild(marker);
        } else {
          const bar = document.createElement('div');
          bar.className = 'task-bar';
          bar.dataset.taskId = t.id;
          if (state.criticalPath.has(t.id)) bar.classList.add('critical');
          if (state.violations.has(t.id)) bar.classList.add('warning');
          if (state.delayed.has(t.id)) bar.classList.add('delayed');

          // Apply assignee color
          const assigneeColor = state.assigneeColors.get(t.assignee);
          if (assigneeColor && !state.criticalPath.has(t.id)) {
            bar.style.background = assigneeColor.bar;
          }
          // Re-apply delayed pattern over assignee color
          if (state.delayed.has(t.id) && assigneeColor && !state.criticalPath.has(t.id)) {
            bar.style.background = `repeating-linear-gradient(135deg, ${assigneeColor.bar}, ${assigneeColor.bar} 4px, rgba(255,255,255,0.3) 4px, rgba(255,255,255,0.3) 8px)`;
          }

          bar.style.left = startX + 'px';
          bar.style.width = (endX - startX) + 'px';

          if (t.progress > 0) {
            const fill = document.createElement('div');
            fill.className = 'progress-fill';
            fill.style.width = t.progress + '%';
            bar.appendChild(fill);
          }

          // Progress text
          const progressText = document.createElement('span');
          progressText.className = 'progress-text';
          progressText.textContent = t.progress + '%';
          bar.appendChild(progressText);

          rowDiv.appendChild(bar);
        }

        if (!isHidden) {
          const midY = rowIdx * rowH + rowH / 2;
          state.taskPositions.set(t.id, { startX, endX, midY });
        }
      }
      body.appendChild(rowDiv);
      const isVisible = row.type === 'group' || !state.collapsed.has(row.groupName);
      if (isVisible) rowIdx++;
    }

    renderTodayLine(body);
    renderArrows(body, rowIdx, rowH);
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

  function renderArrows(body, rowCount, rowH) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('arrows');
    svg.style.width = body.style.width;
    svg.style.height = (rowCount * rowH) + 'px';

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
        line.dataset.from = depId;
        line.dataset.to = t.id;
        svg.appendChild(line);

        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points', `${x2},${y2} ${x2 - 6},${y2 - 4} ${x2 - 6},${y2 + 4}`);
        arrow.dataset.from = depId;
        arrow.dataset.to = t.id;
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
    document.getElementById('btn-month').classList.toggle('active', mode === 'month');
    render();
  }

  function renderSummary() {
    const today = getTodayStr();
    const summary = GanttCore.calculateSummary(state.tasks, { path: state.criticalPath, totalDays: 0 }, today);
    state.summary = summary;

    const progEl = document.getElementById('summary-progress');
    progEl.textContent = summary.overallProgress + '%';
    progEl.className = 'value' + (summary.overallProgress >= 80 ? ' good' : '');

    const delayEl = document.getElementById('summary-delayed');
    delayEl.textContent = summary.delayedCount;
    delayEl.className = 'value' + (summary.delayedCount > 0 ? ' delayed' : ' good');

    const cpEl = document.getElementById('summary-critical-days');
    cpEl.textContent = summary.criticalDays + '日';
    cpEl.className = 'value';
  }

  function populateFilterDropdowns() {
    const assignees = [...new Set(state.tasks.map(t => t.assignee))].sort();
    const groups = [...new Set(state.tasks.map(t => t.group))];

    const assigneeSel = document.getElementById('filter-assignee');
    for (const a of assignees) {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      assigneeSel.appendChild(opt);
    }

    const groupSel = document.getElementById('filter-group');
    for (const g of groups) {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      groupSel.appendChild(opt);
    }
  }

  function render() {
    state.rows = buildRows();
    renderSidebar();
    renderTimelineHeader();
    renderTimelineBody();
    renderSummary();
  }

  // Public API

  function getState() {
    return state;
  }

  function applyFilter(filter) {
    const today = getTodayStr();
    if (!filter || (Object.keys(filter).length === 0) ||
        (!filter.assignee && !filter.group && !filter.delayedOnly && !filter.criticalOnly)) {
      state.filteredTasks = null;
      state.filter = {};
    } else {
      state.filter = filter;
      state.filteredTasks = GanttCore.filterTasks(state.tasks, filter, { today, criticalPath: state.criticalPath });
    }
    render();
  }

  function toggleLoadView() {
    state.loadViewActive = !state.loadViewActive;
    const loadView = document.getElementById('load-view');
    const btn = document.getElementById('btn-load-view');
    if (state.loadViewActive) {
      loadView.classList.add('active');
      btn.classList.add('active');
      renderLoadView();
    } else {
      loadView.classList.remove('active');
      btn.classList.remove('active');
    }
  }

  function renderLoadView() {
    const container = document.getElementById('load-view-content');
    container.innerHTML = '';
    const load = GanttCore.calculateAssigneeLoad(state.tasks);
    const range = state.dateRange;
    const totalDays = GanttCore.daysBetween(range.start, range.end);

    for (const [assignee, entries] of load) {
      const div = document.createElement('div');
      div.className = 'load-assignee';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'load-assignee-name';
      nameDiv.textContent = assignee;
      div.appendChild(nameDiv);

      const barContainer = document.createElement('div');
      barContainer.className = 'load-bar-container';
      barContainer.style.width = '100%';

      for (const entry of entries) {
        const start = GanttCore.daysBetween(range.start, GanttCore.parseDate(entry.start_date));
        const end = GanttCore.daysBetween(range.start, GanttCore.parseDate(entry.end_date));
        const leftPct = (start / totalDays * 100);
        const widthPct = ((end - start + 1) / totalDays * 100);

        const taskBar = document.createElement('div');
        taskBar.className = 'load-bar-task';
        const color = state.assigneeColors.get(assignee);
        taskBar.style.background = color ? color.bar : 'var(--color-bar)';
        taskBar.style.left = leftPct + '%';
        taskBar.style.width = widthPct + '%';
        taskBar.textContent = entry.taskId;
        barContainer.appendChild(taskBar);
      }

      div.appendChild(barContainer);
      container.appendChild(div);
    }
  }

  function scrollToToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today < state.dateRange.start || today > state.dateRange.end) return;
    const x = dayToX(today);
    const timeline = document.getElementById('timeline');
    timeline.scrollLeft = Math.max(0, x - timeline.clientWidth / 2);
  }

  function expandAll() {
    state.collapsed.clear();
    render();
  }

  function collapseAll() {
    const groups = GanttCore.groupTasks(state.tasks);
    for (const g of groups) {
      state.collapsed.add(g.name);
    }
    render();
  }

  function highlightDependencyChain(taskId) {
    // Find all tasks in the dependency chain (ancestors + descendants)
    const chain = new Set();
    const taskMap = new Map();
    for (const t of state.tasks) taskMap.set(t.id, t);

    // Walk ancestors
    function walkUp(id) {
      if (chain.has(id)) return;
      chain.add(id);
      const t = taskMap.get(id);
      if (!t) return;
      for (const dep of t.depends_on) walkUp(dep);
    }
    // Walk descendants
    function walkDown(id) {
      if (chain.has(id)) return;
      chain.add(id);
      for (const t of state.tasks) {
        if (t.depends_on.includes(id)) walkDown(t.id);
      }
    }
    walkUp(taskId);
    walkDown(taskId);

    state.highlightedChain = chain;

    // Apply visual highlights
    document.querySelectorAll('.task-bar.dep-highlight, .milestone-marker.dep-highlight').forEach(el => el.classList.remove('dep-highlight'));
    document.querySelectorAll('svg.arrows line.dep-highlight, svg.arrows polygon.dep-highlight').forEach(el => el.classList.remove('dep-highlight'));

    for (const id of chain) {
      const bars = document.querySelectorAll(`.task-bar[data-task-id="${id}"], .milestone-marker[data-task-id="${id}"]`);
      bars.forEach(b => b.classList.add('dep-highlight'));
    }

    // Highlight arrows in chain
    document.querySelectorAll('svg.arrows line, svg.arrows polygon').forEach(el => {
      if (chain.has(el.dataset.from) && chain.has(el.dataset.to)) {
        el.classList.add('dep-highlight');
      }
    });
  }

  function clearHighlights() {
    state.highlightedChain = null;
    document.querySelectorAll('.dep-highlight').forEach(el => el.classList.remove('dep-highlight'));
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

    const today = getTodayStr();

    state = {
      tasks: data.tasks,
      dateRange: GanttCore.getDateRange(data.tasks),
      criticalPath: cp.path,
      violations: GanttCore.checkViolations(data.tasks),
      mode: 'day',
      collapsed: new Set(),
      rows: [],
      taskPositions: new Map(),
      // New state
      delayed: GanttCore.getDelayedTasks(data.tasks, today),
      summary: null,
      assigneeColors: GanttCore.assignColors(data.tasks),
      groupColors: new Map(),
      filter: {},
      filteredTasks: null,
      loadViewActive: false,
      milestoneDays: GanttCore.milestoneDaysLeft(data.tasks, today),
      highlightedChain: null,
    };

    // Set up group colors
    const groups = GanttCore.groupTasks(data.tasks);
    groups.forEach((g, i) => {
      state.groupColors.set(g.name, GROUP_COLORS[i % GROUP_COLORS.length]);
    });

    populateFilterDropdowns();

    document.getElementById('btn-day').addEventListener('click', () => setMode('day'));
    document.getElementById('btn-week').addEventListener('click', () => setMode('week'));
    document.getElementById('btn-month').addEventListener('click', () => setMode('month'));

    render();

    // Bind UI events after initial render
    if (typeof GanttUI !== 'undefined') {
      GanttUI.bindEvents(state);
    }
  }

  return {
    init,
    getState,
    applyFilter,
    toggleLoadView,
    scrollToToday,
    expandAll,
    collapseAll,
    highlightDependencyChain,
    clearHighlights,
    render,
    setMode,
  };
})();
