/**
 * Tests for groupTasksByProject() — the new 2-level grouping function.
 *
 * gantt-core.js is a browser IIFE (not ESM), so we cannot import it directly.
 * core-extensions.js mirrors gantt-core functions for Node testing.
 * Once groupTasksByProject is added to core-extensions.js, this test will import it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { groupTasksByProject } from '../lib/core-extensions.js';

function makeTask(overrides) {
  return {
    id: 'task-1',
    name: 'Task 1',
    assignee: 'Tanaka',
    effort: 3,
    start_date: '2026-04-10',
    end_date: '2026-04-14',
    progress: 0,
    depends_on: [],
    project: 'EC Site',
    group: 'Design',
    milestone: false,
    ...overrides,
  };
}

describe('groupTasksByProject', () => {
  it('should group tasks by project', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', project: 'EC Site', group: 'Design' }),
      makeTask({ id: 'b', project: 'EC Site', group: 'Impl' }),
      makeTask({ id: 'c', project: 'Infra', group: 'Plan' }),
    ];

    // When
    const result = groupTasksByProject(tasks);

    // Then
    assert.equal(result.length, 2);
    assert.equal(result[0].project, 'EC Site');
    assert.equal(result[1].project, 'Infra');
  });

  it('should group tasks within a project by group name', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', project: 'EC Site', group: 'Design' }),
      makeTask({ id: 'b', project: 'EC Site', group: 'Impl' }),
      makeTask({ id: 'c', project: 'EC Site', group: 'Design' }),
    ];

    // When
    const result = groupTasksByProject(tasks);

    // Then
    assert.equal(result.length, 1);
    const ecGroups = result[0].groups;
    assert.equal(ecGroups.length, 2);
    assert.equal(ecGroups[0].name, 'Design');
    assert.equal(ecGroups[0].tasks.length, 2);
    assert.equal(ecGroups[1].name, 'Impl');
    assert.equal(ecGroups[1].tasks.length, 1);
  });

  it('should place tasks without group in a null-name group', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', project: 'EC Site', group: 'Design' }),
      makeTask({ id: 'b', project: 'EC Site', group: undefined }),
    ];

    // When
    const result = groupTasksByProject(tasks);

    // Then
    const ecGroups = result[0].groups;
    const nullGroup = ecGroups.find((g) => g.name === null);
    assert.ok(nullGroup, 'should have a null-name group');
    assert.equal(nullGroup.tasks.length, 1);
    assert.equal(nullGroup.tasks[0].id, 'b');
  });

  it('should preserve insertion order of projects', () => {
    // Given: tasks arrive in order Infra, EC Site, Mobile
    const tasks = [
      makeTask({ id: 'a', project: 'Infra', group: 'Plan' }),
      makeTask({ id: 'b', project: 'EC Site', group: 'Design' }),
      makeTask({ id: 'c', project: 'Mobile', group: 'Dev' }),
    ];

    // When
    const result = groupTasksByProject(tasks);

    // Then: order matches first appearance
    assert.equal(result[0].project, 'Infra');
    assert.equal(result[1].project, 'EC Site');
    assert.equal(result[2].project, 'Mobile');
  });

  it('should preserve insertion order of groups within a project', () => {
    // Given: groups appear in order Impl, Design, Test
    const tasks = [
      makeTask({ id: 'a', project: 'EC Site', group: 'Impl' }),
      makeTask({ id: 'b', project: 'EC Site', group: 'Design' }),
      makeTask({ id: 'c', project: 'EC Site', group: 'Test' }),
    ];

    // When
    const result = groupTasksByProject(tasks);

    // Then
    const groups = result[0].groups;
    assert.equal(groups[0].name, 'Impl');
    assert.equal(groups[1].name, 'Design');
    assert.equal(groups[2].name, 'Test');
  });

  it('should return empty array for empty tasks', () => {
    // When
    const result = groupTasksByProject([]);

    // Then
    assert.deepEqual(result, []);
  });

  it('should handle single project with single task', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', project: 'Solo', group: 'Only' }),
    ];

    // When
    const result = groupTasksByProject(tasks);

    // Then
    assert.equal(result.length, 1);
    assert.equal(result[0].project, 'Solo');
    assert.equal(result[0].groups.length, 1);
    assert.equal(result[0].groups[0].name, 'Only');
    assert.equal(result[0].groups[0].tasks.length, 1);
  });

  it('should handle all tasks without group (project-direct)', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', project: 'P1', group: undefined }),
      makeTask({ id: 'b', project: 'P1', group: undefined }),
    ];

    // When
    const result = groupTasksByProject(tasks);

    // Then
    assert.equal(result.length, 1);
    assert.equal(result[0].groups.length, 1);
    assert.equal(result[0].groups[0].name, null);
    assert.equal(result[0].groups[0].tasks.length, 2);
  });

  it('should correctly return task references (not copies)', () => {
    // Given
    const task = makeTask({ id: 'ref-check', project: 'P1', group: 'G1' });
    const tasks = [task];

    // When
    const result = groupTasksByProject(tasks);

    // Then: same reference
    assert.equal(result[0].groups[0].tasks[0], task);
  });

  it('should handle mixed: some tasks with group, some without, across multiple projects', () => {
    // Given
    const tasks = [
      makeTask({ id: 'a', project: 'P1', group: 'G1' }),
      makeTask({ id: 'b', project: 'P1', group: undefined }),
      makeTask({ id: 'c', project: 'P2', group: 'G2' }),
      makeTask({ id: 'd', project: 'P2', group: undefined }),
      makeTask({ id: 'e', project: 'P2', group: 'G2' }),
    ];

    // When
    const result = groupTasksByProject(tasks);

    // Then
    assert.equal(result.length, 2);

    // P1: G1 (1 task) + null (1 task)
    const p1 = result[0];
    assert.equal(p1.project, 'P1');
    assert.equal(p1.groups.length, 2);
    assert.equal(p1.groups[0].name, 'G1');
    assert.equal(p1.groups[0].tasks.length, 1);
    assert.equal(p1.groups[1].name, null);
    assert.equal(p1.groups[1].tasks.length, 1);

    // P2: G2 (2 tasks) + null (1 task)
    const p2 = result[1];
    assert.equal(p2.project, 'P2');
    assert.equal(p2.groups.length, 2);
    assert.equal(p2.groups[0].name, 'G2');
    assert.equal(p2.groups[0].tasks.length, 2);
    assert.equal(p2.groups[1].name, null);
    assert.equal(p2.groups[1].tasks.length, 1);
  });
});
