/* global GanttRender, GanttCore */
'use strict';

const GanttUI = (() => {
  let _state = null;
  let _pinchStartDist = 0;
  let _pinchZoomFactor = 1.0;
  let _touchStartX = 0;
  let _touchStartY = 0;
  let _drawerSwipeActive = false;

  function bindEvents(state) {
    _state = state;

    bindFilterEvents();
    bindTodayButton();
    bindExpandCollapseButtons();
    bindLoadViewButton();
    bindDrawerEvents();
    bindPopoverEvents();
    bindTooltipEvents();
    bindPinchZoom();
    bindDependencyHighlight();
  }

  // --- Filters ---

  function bindFilterEvents() {
    const assigneeSel = document.getElementById('filter-assignee');
    const groupSel = document.getElementById('filter-group');
    const statusSel = document.getElementById('filter-status');

    function applyCurrentFilter() {
      const filter = {};
      if (assigneeSel.value) filter.assignee = assigneeSel.value;
      if (groupSel.value) filter.group = groupSel.value;
      if (statusSel.value === 'delayed') filter.delayedOnly = true;
      if (statusSel.value === 'critical') filter.criticalOnly = true;
      GanttRender.applyFilter(filter);
    }

    assigneeSel.addEventListener('change', applyCurrentFilter);
    groupSel.addEventListener('change', applyCurrentFilter);
    statusSel.addEventListener('change', applyCurrentFilter);
  }

  // --- Today jump ---

  function bindTodayButton() {
    document.getElementById('btn-today').addEventListener('click', () => {
      GanttRender.scrollToToday();
    });
  }

  // --- Expand / Collapse ---

  function bindExpandCollapseButtons() {
    document.getElementById('btn-expand-all').addEventListener('click', () => {
      GanttRender.expandAll();
    });
    document.getElementById('btn-collapse-all').addEventListener('click', () => {
      GanttRender.collapseAll();
    });
  }

  // --- Load View ---

  function bindLoadViewButton() {
    document.getElementById('btn-load-view').addEventListener('click', () => {
      GanttRender.toggleLoadView();
    });
  }

  // --- Drawer (mobile sidebar) ---

  function bindDrawerEvents() {
    const toggle = document.getElementById('drawer-toggle');
    const overlay = document.getElementById('drawer-overlay');
    const sidebar = document.getElementById('sidebar');

    function openDrawer() {
      sidebar.classList.add('drawer-open');
      overlay.classList.add('visible');
    }

    function closeDrawer() {
      sidebar.classList.remove('drawer-open');
      overlay.classList.remove('visible');
    }

    toggle.addEventListener('click', openDrawer);
    overlay.addEventListener('click', closeDrawer);

    // Touch swipe: left edge -> right to open, swipe left to close
    document.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      _touchStartX = touch.clientX;
      _touchStartY = touch.clientY;
      _drawerSwipeActive = touch.clientX < 30; // Near left edge
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      if (!_drawerSwipeActive) return;
      const touch = e.touches[0];
      const dx = touch.clientX - _touchStartX;
      const dy = Math.abs(touch.clientY - _touchStartY);
      if (dy > Math.abs(dx)) { _drawerSwipeActive = false; return; }
      // Swipe right to open
      if (dx > 60 && !sidebar.classList.contains('drawer-open')) {
        openDrawer();
        _drawerSwipeActive = false;
      }
    }, { passive: true });

    // Swipe left on sidebar to close
    sidebar.addEventListener('touchstart', (e) => {
      _touchStartX = e.touches[0].clientX;
    }, { passive: true });

    sidebar.addEventListener('touchmove', (e) => {
      const dx = e.touches[0].clientX - _touchStartX;
      if (dx < -60 && sidebar.classList.contains('drawer-open')) {
        closeDrawer();
      }
    }, { passive: true });
  }

  // --- Popover ---

  function bindPopoverEvents() {
    const popover = document.getElementById('popover');
    const body = document.getElementById('timeline-body');

    body.addEventListener('click', (e) => {
      const bar = e.target.closest('.task-bar, .milestone-marker');
      if (!bar) {
        hidePopover();
        GanttRender.clearHighlights();
        return;
      }

      const taskId = bar.dataset.taskId;
      if (!taskId) return;

      const state = GanttRender.getState();
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;

      showPopover(task, e.clientX, e.clientY);
    });

    // Close popover on outside click
    document.addEventListener('click', (e) => {
      if (e.target.closest('#popover') || e.target.closest('.task-bar') || e.target.closest('.milestone-marker')) return;
      hidePopover();
    });
  }

  function showPopover(task, x, y) {
    const popover = document.getElementById('popover');
    const state = GanttRender.getState();

    const depNames = task.depends_on.map(id => {
      const dep = state.tasks.find(t => t.id === id);
      return dep ? dep.name : id;
    });

    popover.innerHTML = `
      <div class="popover-title">${escapeHtml(task.name)}</div>
      <div class="popover-row"><span class="popover-label">担当者</span><span class="popover-value">${escapeHtml(task.assignee)}</span></div>
      <div class="popover-row"><span class="popover-label">期間</span><span class="popover-value">${task.start_date} ~ ${task.end_date}</span></div>
      <div class="popover-row"><span class="popover-label">進捗</span><span class="popover-value">${task.progress}%</span></div>
      ${depNames.length > 0 ? `<div class="popover-row"><span class="popover-label">依存先</span><span class="popover-value">${depNames.map(n => escapeHtml(n)).join(', ')}</span></div>` : ''}
      <div class="popover-progress-bar"><div class="popover-progress-fill" style="width:${task.progress}%"></div></div>
    `;

    // Position: try to keep within viewport
    popover.style.display = 'block';
    const rect = popover.getBoundingClientRect();
    let left = x + 10;
    let top = y + 10;
    if (left + rect.width > window.innerWidth) left = x - rect.width - 10;
    if (top + rect.height > window.innerHeight) top = y - rect.height - 10;
    popover.style.left = Math.max(4, left) + 'px';
    popover.style.top = Math.max(4, top) + 'px';
  }

  function hidePopover() {
    document.getElementById('popover').style.display = 'none';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Tooltip (PC hover) ---

  function bindTooltipEvents() {
    // Only on devices that support hover
    if (!window.matchMedia('(hover: hover)').matches) return;

    const body = document.getElementById('timeline-body');
    const tooltip = document.getElementById('tooltip');

    body.addEventListener('mouseenter', (e) => {
      const bar = e.target.closest('.task-bar, .milestone-marker');
      if (!bar) return;
      const taskId = bar.dataset.taskId;
      if (!taskId) return;
      const state = GanttRender.getState();
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;

      tooltip.textContent = `${task.name} (${task.assignee}) ${task.progress}%`;
      tooltip.style.display = 'block';
    }, true);

    body.addEventListener('mouseleave', (e) => {
      if (e.target.closest('.task-bar, .milestone-marker')) {
        tooltip.style.display = 'none';
      }
    }, true);

    body.addEventListener('mousemove', (e) => {
      if (tooltip.style.display === 'block') {
        tooltip.style.left = (e.clientX + 12) + 'px';
        tooltip.style.top = (e.clientY - 28) + 'px';
      }
    });
  }

  // --- Pinch Zoom ---

  function bindPinchZoom() {
    const body = document.getElementById('timeline-body');

    body.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        _pinchStartDist = getTouchDist(e.touches);
      }
    }, { passive: true });

    body.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dist = getTouchDist(e.touches);
        const scale = dist / _pinchStartDist;
        _pinchZoomFactor = Math.min(3.0, Math.max(0.5, _pinchZoomFactor * scale));
        body.style.transform = `scale(${_pinchZoomFactor})`;
        body.classList.add('pinch-zoom');
        _pinchStartDist = dist;
      }
    }, { passive: true });

    body.addEventListener('touchend', () => {
      // Keep the zoom level applied
    }, { passive: true });
  }

  function getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // --- Dependency highlight ---

  function bindDependencyHighlight() {
    const body = document.getElementById('timeline-body');

    body.addEventListener('dblclick', (e) => {
      const bar = e.target.closest('.task-bar, .milestone-marker');
      if (!bar) {
        GanttRender.clearHighlights();
        return;
      }
      const taskId = bar.dataset.taskId;
      if (!taskId) return;
      GanttRender.highlightDependencyChain(taskId);
    });
  }

  return { bindEvents };
})();
