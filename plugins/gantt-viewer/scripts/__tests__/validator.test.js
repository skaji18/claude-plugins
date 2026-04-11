import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkDependencyViolations,
  checkDateContradictions,
  checkInvalidReferences,
  checkDelayedTasks,
  checkCircularDependencies,
  checkStatusContradictions,
  checkActualDateConsistency,
  runAllChecks,
} from '../lib/validator.js';

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
    group: 'Phase 1',
    milestone: false,
    ...overrides,
  };
}

describe('validator', () => {
  describe('checkCircularDependencies', () => {
    it('should return empty array when no circular dependencies exist', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', depends_on: [] }),
        makeTask({ id: 'b', depends_on: ['a'] }),
        makeTask({ id: 'c', depends_on: ['b'] }),
      ];

      // When
      const results = checkCircularDependencies(tasks);

      // Then
      assert.equal(results.length, 0);
    });

    it('should detect A → B → A circular dependency', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', depends_on: ['b'] }),
        makeTask({ id: 'b', depends_on: ['a'] }),
      ];

      // When
      const results = checkCircularDependencies(tasks);

      // Then
      assert.ok(results.length >= 1);
      assert.equal(results[0].level, 'ERROR');
      assert.equal(results[0].type, 'circular_dependency');
    });

    it('should detect longer circular chain A → B → C → A', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', depends_on: ['c'] }),
        makeTask({ id: 'b', depends_on: ['a'] }),
        makeTask({ id: 'c', depends_on: ['b'] }),
      ];

      // When
      const results = checkCircularDependencies(tasks);

      // Then
      assert.ok(results.length >= 1);
      assert.equal(results[0].level, 'ERROR');
      assert.equal(results[0].type, 'circular_dependency');
    });
  });

  describe('checkDependencyViolations', () => {
    it('should return empty array when no dependency violations exist', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', start_date: '2026-04-10', end_date: '2026-04-14' }),
        makeTask({ id: 'b', start_date: '2026-04-15', end_date: '2026-04-18', depends_on: ['a'] }),
      ];

      // When
      const results = checkDependencyViolations(tasks);

      // Then
      assert.equal(results.length, 0);
    });

    it('should detect task starting before dependency ends', () => {
      // Given
      const tasks = [
        makeTask({ id: 'design', start_date: '2026-04-10', end_date: '2026-04-14' }),
        makeTask({ id: 'impl', start_date: '2026-04-12', end_date: '2026-04-18', depends_on: ['design'] }),
      ];

      // When
      const results = checkDependencyViolations(tasks);

      // Then
      assert.equal(results.length, 1);
      assert.equal(results[0].level, 'ERROR');
      assert.equal(results[0].taskId, 'impl');
      assert.ok(results[0].message.includes('design'));
    });

    it('should allow task starting on the day after dependency ends', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', start_date: '2026-04-10', end_date: '2026-04-14' }),
        makeTask({ id: 'b', start_date: '2026-04-15', end_date: '2026-04-18', depends_on: ['a'] }),
      ];

      // When
      const results = checkDependencyViolations(tasks);

      // Then
      assert.equal(results.length, 0);
    });

    it('should detect multiple dependency violations for one task', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', start_date: '2026-04-10', end_date: '2026-04-14' }),
        makeTask({ id: 'b', start_date: '2026-04-10', end_date: '2026-04-16' }),
        makeTask({ id: 'c', start_date: '2026-04-12', end_date: '2026-04-18', depends_on: ['a', 'b'] }),
      ];

      // When
      const results = checkDependencyViolations(tasks);

      // Then
      assert.equal(results.length, 2);
    });
  });

  describe('checkDateContradictions', () => {
    it('should return empty array when dates are valid', () => {
      // Given
      const tasks = [
        makeTask({ start_date: '2026-04-10', end_date: '2026-04-14' }),
      ];

      // When
      const results = checkDateContradictions(tasks);

      // Then
      assert.equal(results.length, 0);
    });

    it('should detect start_date after end_date', () => {
      // Given
      const tasks = [
        makeTask({ id: 'test', start_date: '2026-04-20', end_date: '2026-04-18' }),
      ];

      // When
      const results = checkDateContradictions(tasks);

      // Then
      assert.equal(results.length, 1);
      assert.equal(results[0].level, 'ERROR');
      assert.equal(results[0].taskId, 'test');
    });

    it('should allow same start_date and end_date', () => {
      // Given
      const tasks = [
        makeTask({ start_date: '2026-04-10', end_date: '2026-04-10' }),
      ];

      // When
      const results = checkDateContradictions(tasks);

      // Then
      assert.equal(results.length, 0);
    });
  });

  describe('checkInvalidReferences', () => {
    it('should return empty array when all references are valid', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a' }),
        makeTask({ id: 'b', depends_on: ['a'] }),
      ];

      // When
      const results = checkInvalidReferences(tasks);

      // Then
      assert.equal(results.length, 0);
    });

    it('should detect reference to non-existent task ID', () => {
      // Given
      const tasks = [
        makeTask({ id: 'deploy', depends_on: ['revieww'] }),
      ];

      // When
      const results = checkInvalidReferences(tasks);

      // Then
      assert.equal(results.length, 1);
      assert.equal(results[0].level, 'ERROR');
      assert.equal(results[0].taskId, 'deploy');
      assert.ok(results[0].message.includes('revieww'));
    });

    it('should detect multiple invalid references', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', depends_on: ['x', 'y'] }),
      ];

      // When
      const results = checkInvalidReferences(tasks);

      // Then
      assert.equal(results.length, 2);
    });

    it('should not flag self-reference as invalid reference but as dependency issue', () => {
      // Given: self-reference is a valid ID but a logical error
      const tasks = [
        makeTask({ id: 'a', depends_on: ['a'] }),
      ];

      // When
      const results = checkInvalidReferences(tasks);

      // Then: ID 'a' exists, so it's not an "invalid reference"
      assert.equal(results.length, 0);
    });
  });

  describe('checkDelayedTasks', () => {
    it('should return empty array when no tasks are delayed', () => {
      // Given
      const today = '2026-04-01';
      const tasks = [
        makeTask({ end_date: '2026-04-14', progress: 0 }),
      ];

      // When
      const results = checkDelayedTasks(tasks, today);

      // Then
      assert.equal(results.length, 0);
    });

    it('should detect task with end_date before today and progress < 100', () => {
      // Given
      const today = '2026-04-15';
      const tasks = [
        makeTask({ id: 'design', end_date: '2026-04-14', progress: 80 }),
      ];

      // When
      const results = checkDelayedTasks(tasks, today);

      // Then
      assert.equal(results.length, 1);
      assert.equal(results[0].level, 'WARN');
      assert.equal(results[0].taskId, 'design');
    });

    it('should not flag completed task as delayed even if end_date is past', () => {
      // Given
      const today = '2026-04-15';
      const tasks = [
        makeTask({ end_date: '2026-04-14', progress: 100 }),
      ];

      // When
      const results = checkDelayedTasks(tasks, today);

      // Then
      assert.equal(results.length, 0);
    });

    it('should not flag task ending today as delayed', () => {
      // Given
      const today = '2026-04-14';
      const tasks = [
        makeTask({ end_date: '2026-04-14', progress: 50 }),
      ];

      // When
      const results = checkDelayedTasks(tasks, today);

      // Then
      assert.equal(results.length, 0);
    });
  });

  describe('checkStatusContradictions', () => {
    it('should return empty array when no contradictions exist', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', progress: 100, actual_end_date: '2026-04-14' }),
        makeTask({ id: 'b', progress: 50 }),
      ];

      // When
      const results = checkStatusContradictions(tasks);

      // Then
      assert.equal(results.length, 0);
    });

    it('should detect actual_end_date set but progress < 100', () => {
      // Given
      const tasks = [
        makeTask({ id: 'x', progress: 80, actual_end_date: '2026-04-14' }),
      ];

      // When
      const results = checkStatusContradictions(tasks);

      // Then
      assert.equal(results.length, 1);
      assert.equal(results[0].level, 'ERROR');
      assert.equal(results[0].type, 'status_contradiction');
      assert.equal(results[0].taskId, 'x');
      assert.ok(results[0].message.includes('80'));
    });

    it('should not flag task without actual_end_date', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', progress: 50 }),
      ];

      // When
      const results = checkStatusContradictions(tasks);

      // Then
      assert.equal(results.length, 0);
    });

    it('should not flag completed task with actual_end_date', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', progress: 100, actual_end_date: '2026-04-14' }),
      ];

      // When
      const results = checkStatusContradictions(tasks);

      // Then
      assert.equal(results.length, 0);
    });
  });

  describe('checkActualDateConsistency', () => {
    it('should return empty array when actual dates are consistent', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', actual_start_date: '2026-04-10', actual_end_date: '2026-04-14' }),
      ];

      // When
      const results = checkActualDateConsistency(tasks);

      // Then
      assert.equal(results.length, 0);
    });

    it('should detect actual_start_date > actual_end_date', () => {
      // Given
      const tasks = [
        makeTask({ id: 'a', actual_start_date: '2026-04-20', actual_end_date: '2026-04-14' }),
      ];

      // When
      const results = checkActualDateConsistency(tasks);

      // Then
      assert.equal(results.length, 1);
      assert.equal(results[0].level, 'ERROR');
      assert.equal(results[0].type, 'actual_date_contradiction');
      assert.equal(results[0].taskId, 'a');
    });

    it('should warn when actual_end_date set without actual_start_date', () => {
      // Given
      const tasks = [
        makeTask({ id: 'b', actual_end_date: '2026-04-14' }),
      ];

      // When
      const results = checkActualDateConsistency(tasks);

      // Then
      assert.equal(results.length, 1);
      assert.equal(results[0].level, 'WARN');
      assert.equal(results[0].type, 'actual_date_incomplete');
      assert.equal(results[0].taskId, 'b');
    });

    it('should not warn when only actual_start_date is set', () => {
      // Given
      const tasks = [
        makeTask({ id: 'c', actual_start_date: '2026-04-10' }),
      ];

      // When
      const results = checkActualDateConsistency(tasks);

      // Then
      assert.equal(results.length, 0);
    });

    it('should allow same actual_start_date and actual_end_date', () => {
      // Given
      const tasks = [
        makeTask({ id: 'd', actual_start_date: '2026-04-14', actual_end_date: '2026-04-14' }),
      ];

      // When
      const results = checkActualDateConsistency(tasks);

      // Then
      assert.equal(results.length, 0);
    });
  });

  describe('runAllChecks', () => {
    it('should aggregate results from all checks', () => {
      // Given: tasks with multiple issues
      const today = '2026-04-20';
      const tasks = [
        makeTask({
          id: 'a',
          start_date: '2026-04-20',
          end_date: '2026-04-18', // date contradiction
        }),
        makeTask({
          id: 'b',
          start_date: '2026-04-10',
          end_date: '2026-04-12',
          progress: 50,
          depends_on: ['nonexistent'], // invalid reference + delayed
        }),
      ];

      // When
      const results = runAllChecks(tasks, today);

      // Then: at least date contradiction + invalid reference + delayed
      assert.ok(results.length >= 3);
    });

    it('should return empty array for valid tasks with no issues', () => {
      // Given
      const today = '2026-04-01';
      const tasks = [
        makeTask({ id: 'a', start_date: '2026-04-10', end_date: '2026-04-14' }),
        makeTask({ id: 'b', start_date: '2026-04-15', end_date: '2026-04-18', depends_on: ['a'] }),
      ];

      // When
      const results = runAllChecks(tasks, today);

      // Then
      assert.equal(results.length, 0);
    });

    it('should include circular dependency results', () => {
      // Given
      const today = '2026-04-01';
      const tasks = [
        makeTask({ id: 'a', start_date: '2026-04-10', end_date: '2026-04-14', depends_on: ['b'] }),
        makeTask({ id: 'b', start_date: '2026-04-10', end_date: '2026-04-14', depends_on: ['a'] }),
      ];

      // When
      const results = runAllChecks(tasks, today);

      // Then
      const circularResults = results.filter((r) => r.type === 'circular_dependency');
      assert.ok(circularResults.length >= 1);
    });

    it('should include status contradiction and actual date consistency results', () => {
      // Given
      const today = '2026-04-01';
      const tasks = [
        makeTask({ id: 'a', start_date: '2026-04-10', end_date: '2026-04-14', progress: 50, actual_end_date: '2026-04-14' }),
        makeTask({ id: 'b', start_date: '2026-04-15', end_date: '2026-04-18', depends_on: ['a'], actual_start_date: '2026-04-20', actual_end_date: '2026-04-16' }),
      ];

      // When
      const results = runAllChecks(tasks, today);

      // Then
      const statusResults = results.filter((r) => r.type === 'status_contradiction');
      assert.ok(statusResults.length >= 1);
      const actualDateResults = results.filter((r) => r.type === 'actual_date_contradiction');
      assert.ok(actualDateResults.length >= 1);
    });

    it('should not include critical path info in results', () => {
      // Given
      const today = '2026-04-01';
      const tasks = [
        makeTask({ id: 'a', start_date: '2026-04-10', end_date: '2026-04-14' }),
        makeTask({ id: 'b', start_date: '2026-04-15', end_date: '2026-04-18', depends_on: ['a'] }),
      ];

      // When
      const results = runAllChecks(tasks, today);

      // Then: runAllChecks does not include critical path (handled by check.js)
      const infoResults = results.filter((r) => r.level === 'INFO');
      assert.equal(infoResults.length, 0);
    });
  });
});
