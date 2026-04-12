/* global GanttCore, GanttUI */
'use strict';

const GanttRender = (() => {
  let state = null;

  const COL_WIDTH_DAY = 32;
  const COL_WIDTH_WEEK = 100;
  const COL_WIDTH_MONTH = 6;

  const ZOOM_STEPS = [0.5, 0.75, 1, 1.5, 2, 3];

  const GROUP_COLORS = [
    'hsl(210, 70%, 50%)',
    'hsl(150, 70%, 40%)',
    'hsl(30, 80%, 50%)',
    'hsl(330, 70%, 50%)',
    'hsl(270, 60%, 50%)',
  ];

  function getBaseColWidth() {
    // Always returns per-day pixel width
    if (state.mode === 'week') return COL_WIDTH_WEEK / 7;
    if (state.mode === 'month') return COL_WIDTH_MONTH;
    return COL_WIDTH_DAY;
  }

  function getColWidth() {
    return getBaseColWidth() * state.zoomFactor;
  }

  function getSidebarWidth() {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 320;
  }

  function buildRows() {
    const projects = GanttCore.groupTasksByProject(state.tasks);
    const rows = [];
    for (let pi = 0; pi < projects.length; pi++) {
      const p = projects[pi];
      const projectKey = `project:${p.project}`;
      rows.push({ type: 'project', name: p.project, collapseKey: projectKey, projectIndex: pi });
      for (let gi = 0; gi < p.groups.length; gi++) {
        const g = p.groups[gi];
        const groupKey = g.name !== null ? `group:${p.project}:${g.name}` : null;
        if (g.name !== null) {
          rows.push({ type: 'group', name: g.name, collapseKey: groupKey, projectName: p.project, projectKey: projectKey, groupIndex: gi, projectIndex: pi });
        }
        for (const t of g.tasks) {
          rows.push({ type: 'task', task: t, groupKey: groupKey, projectKey: projectKey, projectName: p.project, groupName: g.name, projectIndex: pi, groupIndex: gi });
        }
      }
    }
    return rows;
  }

  function isTaskRowHidden(row) {
    return state.collapsed.has(row.projectKey) || (row.groupKey && state.collapsed.has(row.groupKey));
  }

  function getTodayStr() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return GanttCore.formatDate(d);
  }

  function renderSidebar() {
    const container = document.getElementById('sidebar-column');
    container.innerHTML = '';
    for (const row of state.rows) {
      const div = document.createElement('div');
      if (row.type === 'project') {
        div.className = 'sidebar-project';
        if (state.collapsed.has(row.collapseKey)) div.classList.add('collapsed');
        div.textContent = row.name;
        div.addEventListener('click', () => toggleCollapse(row.collapseKey));
      } else if (row.type === 'group') {
        div.className = 'sidebar-group';
        const colorIdx = row.groupIndex % GROUP_COLORS.length;
        div.classList.add('group-color-' + colorIdx);
        if (state.collapsed.has(row.projectKey)) div.classList.add('hidden');
        if (state.collapsed.has(row.collapseKey)) div.classList.add('collapsed');
        div.textContent = row.name;
        div.addEventListener('click', () => toggleCollapse(row.collapseKey));
      } else {
        div.className = 'sidebar-row';
        if (isTaskRowHidden(row)) div.classList.add('hidden');
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
      const weekCellW = colW * 7;
      let d = new Date(range.start);
      const dow = d.getDay();
      if (dow !== 1) d = GanttCore.addDays(d, (8 - dow) % 7);
      let x = GanttCore.daysBetween(range.start, d) * colW;
      while (d <= range.end) {
        const cell = document.createElement('div');
        cell.className = 'header-cell';
        cell.style.left = x + 'px';
        cell.style.width = weekCellW + 'px';
        cell.textContent = GanttCore.formatDate(d);
        header.appendChild(cell);
        d = GanttCore.addDays(d, 7);
        x += weekCellW;
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
    const timelineWidth = (totalDays + 1) * colW;
    header.style.width = timelineWidth + 'px';
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
    const timelineWidth = (totalDays + 1) * colW;
    body.style.width = timelineWidth + 'px';

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

      if (row.type === 'project') {
        rowDiv.classList.add('project-row');
      } else if (row.type === 'group') {
        rowDiv.classList.add('group-row');
        if (state.collapsed.has(row.projectKey)) rowDiv.classList.add('hidden');
      } else {
        if (isTaskRowHidden(row)) rowDiv.classList.add('hidden');
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

          // When actual-compare is active and task has actual data, ghost the planned bar
          const hasActual = state.actualCompareActive && t.actual_start_date;
          if (hasActual) bar.classList.add('planned-ghost');

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

          // Effort label
          if (t.effort != null) {
            const effortLabel = document.createElement('span');
            effortLabel.className = 'effort-label';
            effortLabel.textContent = t.effort + 'd';
            bar.appendChild(effortLabel);
          }

          // Progress text
          const progressText = document.createElement('span');
          progressText.className = 'progress-text';
          progressText.textContent = t.progress + '%';
          bar.appendChild(progressText);

          // Bar label (task name, shown on mobile via CSS)
          const barWidth = endX - startX;
          const barLabel = document.createElement('span');
          barLabel.className = 'bar-label';
          barLabel.textContent = t.name;
          if (barWidth >= 80) {
            // Long bar: label inside
            barLabel.classList.add('bar-label-inside');
            bar.appendChild(barLabel);
          } else {
            // Short bar: label outside (right of bar)
            barLabel.classList.add('bar-label-outside');
            barLabel.style.left = (startX + barWidth + 4) + 'px';
            rowDiv.appendChild(barLabel);
          }

          rowDiv.appendChild(bar);

          // Actual bar (when actual-compare mode is active)
          if (hasActual) {
            const actualStart = GanttCore.parseDate(t.actual_start_date);
            const actualEndStr = t.actual_end_date || getTodayStr();
            const actualEnd = GanttCore.parseDate(actualEndStr);
            const actualStartX = dayToX(actualStart);
            const actualEndX = dayToX(actualEnd) + colW;

            const actualBar = document.createElement('div');
            actualBar.className = 'task-bar actual-bar';
            actualBar.dataset.taskId = t.id;
            if (state.criticalPath.has(t.id)) actualBar.classList.add('critical');
            if (state.delayed.has(t.id)) actualBar.classList.add('delayed');

            if (assigneeColor && !state.criticalPath.has(t.id)) {
              actualBar.style.background = assigneeColor.bar;
            }
            if (state.delayed.has(t.id) && assigneeColor && !state.criticalPath.has(t.id)) {
              actualBar.style.background = `repeating-linear-gradient(135deg, ${assigneeColor.bar}, ${assigneeColor.bar} 4px, rgba(255,255,255,0.3) 4px, rgba(255,255,255,0.3) 8px)`;
            }

            actualBar.style.left = actualStartX + 'px';
            actualBar.style.width = (actualEndX - actualStartX) + 'px';

            if (t.progress > 0) {
              const actualFill = document.createElement('div');
              actualFill.className = 'progress-fill';
              actualFill.style.width = t.progress + '%';
              actualBar.appendChild(actualFill);
            }

            const actualProgressText = document.createElement('span');
            actualProgressText.className = 'progress-text';
            actualProgressText.textContent = t.progress + '%';
            actualBar.appendChild(actualProgressText);

            rowDiv.appendChild(actualBar);
          }
        }

        if (!isTaskRowHidden(row)) {
          const midY = rowIdx * rowH + rowH / 2;
          state.taskPositions.set(t.id, { startX, endX, midY });
        }
      }
      body.appendChild(rowDiv);
      let isVisible;
      if (row.type === 'project') {
        isVisible = true;
      } else if (row.type === 'group') {
        isVisible = !state.collapsed.has(row.projectKey);
      } else {
        isVisible = !isTaskRowHidden(row);
      }
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

  function toggleCollapse(key) {
    if (state.collapsed.has(key)) {
      state.collapsed.delete(key);
    } else {
      state.collapsed.add(key);
    }
    render();
  }

  function setMode(mode) {
    state.mode = mode;
    state.dateRange = GanttCore.getDateRangeForMode(state.tasks, mode);
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

    // Effort summary
    const effortEl = document.getElementById('summary-effort');
    let totalEffort = 0;
    let hasEffort = false;
    const assigneeEffort = new Map();
    for (const t of state.tasks) {
      if (t.effort != null) {
        totalEffort += t.effort;
        hasEffort = true;
        const prev = assigneeEffort.get(t.assignee) || 0;
        assigneeEffort.set(t.assignee, prev + t.effort);
      }
    }
    if (hasEffort) {
      effortEl.textContent = totalEffort + 'd';
      const breakdown = [];
      for (const [name, val] of assigneeEffort) {
        breakdown.push(name + ': ' + val + 'd');
      }
      effortEl.title = breakdown.join(', ');
    } else {
      effortEl.textContent = '-';
      effortEl.title = '';
    }
    effortEl.className = 'value';
  }

  function populateFilterDropdowns() {
    const assignees = [...new Set(state.tasks.map(t => t.assignee))].sort();
    const projects = [...new Set(state.tasks.map(t => t.project))];
    const groups = [...new Set(state.tasks.filter(t => t.group).map(t => t.group))];

    const assigneeSel = document.getElementById('filter-assignee');
    for (const a of assignees) {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a;
      assigneeSel.appendChild(opt);
    }

    const projectSel = document.getElementById('filter-project');
    for (const p of projects) {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      projectSel.appendChild(opt);
    }

    const groupSel = document.getElementById('filter-group');
    for (const g of groups) {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = g;
      groupSel.appendChild(opt);
    }
  }

  /** Set #chart-grid explicit width so the grid overflows chart-wrapper correctly */
  function updateGridSize() {
    const totalDays = GanttCore.daysBetween(state.dateRange.start, state.dateRange.end);
    const timelineWidth = (totalDays + 1) * getColWidth();
    const sidebarWidth = getSidebarWidth();
    const grid = document.getElementById('chart-grid');
    grid.style.width = (sidebarWidth + timelineWidth) + 'px';
  }

  function render() {
    state.rows = buildRows();
    renderSidebar();
    renderTimelineHeader();
    renderTimelineBody();
    renderSummary();
    updateGridSize();
  }

  // Public API

  function getState() {
    return state;
  }

  function applyFilter(filter) {
    const today = getTodayStr();
    if (!filter || (Object.keys(filter).length === 0) ||
        (!filter.assignee && !filter.group && !filter.project && !filter.delayedOnly && !filter.criticalOnly)) {
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
    const colW = getColWidth();
    const range = state.dateRange;
    const totalDays = GanttCore.daysBetween(range.start, range.end);
    const timelineWidth = (totalDays + 1) * colW;
    const subRowHeight = 28;

    // Build the 4-quadrant grid
    const grid = document.createElement('div');
    grid.className = 'load-grid';

    // -- Corner header (top-left) --
    const corner = document.createElement('div');
    corner.className = 'load-corner-header';
    corner.textContent = '担当者';
    grid.appendChild(corner);

    // -- Date header (top-right) --
    const dateHeader = document.createElement('div');
    dateHeader.className = 'load-timeline-header';
    dateHeader.style.width = timelineWidth + 'px';
    // Render date cells same as main header
    if (state.mode === 'week') {
      const weekCellW = colW * 7;
      let d = new Date(range.start);
      const dow = d.getDay();
      if (dow !== 1) d = GanttCore.addDays(d, (8 - dow) % 7);
      let x = GanttCore.daysBetween(range.start, d) * colW;
      while (d <= range.end) {
        const cell = document.createElement('div');
        cell.className = 'header-cell';
        cell.style.left = x + 'px';
        cell.style.width = weekCellW + 'px';
        cell.textContent = GanttCore.formatDate(d);
        dateHeader.appendChild(cell);
        d = GanttCore.addDays(d, 7);
        x += weekCellW;
      }
    } else if (state.mode === 'month') {
      let prevMonth = -1;
      for (let i = 0; i <= totalDays; i++) {
        const d = GanttCore.addDays(range.start, i);
        const m = d.getMonth();
        if (m !== prevMonth) {
          const cell = document.createElement('div');
          cell.className = 'header-cell';
          cell.style.left = (i * colW) + 'px';
          let daysInMonth = 1;
          for (let j = i + 1; j <= totalDays; j++) {
            if (GanttCore.addDays(range.start, j).getMonth() !== m) break;
            daysInMonth++;
          }
          cell.style.width = (daysInMonth * colW) + 'px';
          cell.textContent = `${d.getFullYear()}/${m + 1}`;
          dateHeader.appendChild(cell);
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
        dateHeader.appendChild(cell);
      }
    }
    grid.appendChild(dateHeader);

    // -- Sidebar (bottom-left) and Timeline body (bottom-right) --
    const sidebar = document.createElement('div');
    sidebar.className = 'load-sidebar';

    const body = document.createElement('div');
    body.className = 'load-body';
    body.style.width = timelineWidth + 'px';

    // Grid lines and weekend backgrounds
    for (let i = 0; i <= totalDays; i++) {
      const d = GanttCore.addDays(range.start, i);
      const dow = d.getDay();
      const line = document.createElement('div');
      line.className = 'grid-line';
      line.style.left = (i * colW) + 'px';
      body.appendChild(line);
      if (dow === 0 || dow === 6) {
        const we = document.createElement('div');
        we.className = 'weekend-col';
        we.style.left = (i * colW) + 'px';
        we.style.width = colW + 'px';
        body.appendChild(we);
      }
    }

    // Today line
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today >= range.start && today <= range.end) {
      const tx = dayToX(today) + colW / 2;
      const todayLine = document.createElement('div');
      todayLine.className = 'today-line';
      todayLine.style.left = tx + 'px';
      body.appendChild(todayLine);
    }

    // Render each assignee
    for (const [assignee, entries] of load) {
      const subRows = GanttCore.packSubRows(entries);
      const assigneeHeight = subRows.length * subRowHeight;

      // Sidebar: assignee name spanning all sub-rows
      const nameDiv = document.createElement('div');
      nameDiv.className = 'load-sidebar-name';
      nameDiv.style.height = assigneeHeight + 'px';
      nameDiv.textContent = assignee;
      sidebar.appendChild(nameDiv);

      // Timeline: container for this assignee's sub-rows
      const rowContainer = document.createElement('div');
      rowContainer.className = 'load-assignee-row';
      rowContainer.style.height = assigneeHeight + 'px';

      for (let ri = 0; ri < subRows.length; ri++) {
        for (const entry of subRows[ri]) {
          const startX = dayToX(GanttCore.parseDate(entry.start_date));
          const endX = dayToX(GanttCore.parseDate(entry.end_date)) + colW;
          const barWidth = endX - startX;

          const taskBar = document.createElement('div');
          taskBar.className = 'load-bar-task';
          const color = state.assigneeColors.get(assignee);
          taskBar.style.background = color ? color.bar : 'var(--color-bar)';
          taskBar.style.left = startX + 'px';
          taskBar.style.width = barWidth + 'px';
          taskBar.style.top = (ri * subRowHeight + 2) + 'px';
          taskBar.style.height = (subRowHeight - 4) + 'px';

          // Task name label
          const label = document.createElement('span');
          label.className = 'load-bar-label';
          label.textContent = entry.name;
          taskBar.appendChild(label);

          // Effort label in load view
          if (entry.effort != null) {
            const effortSpan = document.createElement('span');
            effortSpan.className = 'load-bar-effort';
            effortSpan.textContent = ' (' + entry.effort + 'd)';
            taskBar.appendChild(effortSpan);
          }

          rowContainer.appendChild(taskBar);
        }
      }

      body.appendChild(rowContainer);
    }

    grid.appendChild(sidebar);
    grid.appendChild(body);
    container.appendChild(grid);
  }

  function scrollToToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (today < state.dateRange.start || today > state.dateRange.end) return;
    const x = dayToX(today);
    const wrapper = document.getElementById('chart-wrapper');
    wrapper.scrollLeft = Math.max(0, x - wrapper.clientWidth / 2);
  }

  function expandAll() {
    state.collapsed.clear();
    render();
  }

  function collapseAll() {
    const projects = GanttCore.groupTasksByProject(state.tasks);
    for (const p of projects) {
      state.collapsed.add(`project:${p.project}`);
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

  function updateZoomLabel() {
    const label = document.getElementById('zoom-label');
    if (label) {
      const display = state.zoomFactor === Math.floor(state.zoomFactor)
        ? state.zoomFactor + 'x'
        : state.zoomFactor + 'x';
      label.textContent = display;
    }
  }

  function zoomWithPreservedScroll(changeFn) {
    const wrapper = document.getElementById('chart-wrapper');
    const ratio = wrapper.scrollWidth > 0 ? wrapper.scrollLeft / wrapper.scrollWidth : 0;
    changeFn();
    requestAnimationFrame(() => {
      wrapper.scrollLeft = wrapper.scrollWidth * ratio;
    });
  }

  function zoomIn() {
    const idx = ZOOM_STEPS.indexOf(state.zoomFactor);
    if (idx < ZOOM_STEPS.length - 1) {
      zoomWithPreservedScroll(() => {
        state.zoomFactor = ZOOM_STEPS[idx + 1];
        updateZoomLabel();
        render();
      });
    }
  }

  function zoomOut() {
    const idx = ZOOM_STEPS.indexOf(state.zoomFactor);
    if (idx > 0) {
      zoomWithPreservedScroll(() => {
        state.zoomFactor = ZOOM_STEPS[idx - 1];
        updateZoomLabel();
        render();
      });
    }
  }

  function toggleActualCompare() {
    state.actualCompareActive = !state.actualCompareActive;
    const btn = document.getElementById('btn-actual-compare');
    btn.classList.toggle('active', state.actualCompareActive);
    render();
  }

  function clearHighlights() {
    state.highlightedChain = null;
    document.querySelectorAll('.dep-highlight').forEach(el => el.classList.remove('dep-highlight'));
  }

  function _initFromData(data) {
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
      members: data.members || null,
      groups: data.groups || null,
      dateRange: GanttCore.getDateRange(data.tasks),
      criticalPath: cp.path,
      violations: GanttCore.checkViolations(data.tasks),
      mode: 'day',
      collapsed: new Set(),
      rows: [],
      taskPositions: new Map(),
      delayed: GanttCore.getDelayedTasks(data.tasks, today),
      summary: null,
      assigneeColors: GanttCore.assignColors(data.tasks),
      filter: {},
      filteredTasks: null,
      loadViewActive: false,
      milestoneDays: GanttCore.milestoneDaysLeft(data.tasks, today),
      highlightedChain: null,
      zoomFactor: 1.0,
      actualCompareActive: false,
    };

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

  async function init(yamlUrl) {
    const data = await GanttCore.loadYaml(yamlUrl);
    _initFromData(data);
  }

  function initWithData(data) {
    _initFromData(data);
  }

  return {
    init,
    initWithData,
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
    zoomIn,
    zoomOut,
    toggleActualCompare,
  };
})();
