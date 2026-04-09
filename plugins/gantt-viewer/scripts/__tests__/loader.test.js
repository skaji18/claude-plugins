import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadTasks } from '../lib/loader.js';

const FIXTURE_DIR = join(tmpdir(), 'gantt-loader-test');

function writeYaml(filename, content) {
  writeFileSync(join(FIXTURE_DIR, filename), content, 'utf8');
}

function yamlPath(filename) {
  return join(FIXTURE_DIR, filename);
}

const VALID_TASK = {
  id: 'task-1',
  name: 'Design',
  assignee: 'Tanaka',
  effort: 3,
  start_date: '2026-04-10',
  end_date: '2026-04-14',
  progress: 0,
  depends_on: [],
  group: 'Planning',
  milestone: false,
};

function buildYaml(tasks, projectName) {
  const project = `project:\n  name: "${projectName || 'Test Project'}"\n`;
  const taskLines = tasks.map((t) => {
    const lines = [
      `  - id: "${t.id}"`,
      `    name: "${t.name}"`,
      `    assignee: "${t.assignee}"`,
      `    effort: ${t.effort}`,
      `    start_date: "${t.start_date}"`,
      `    end_date: "${t.end_date}"`,
      `    progress: ${t.progress}`,
      `    depends_on: [${t.depends_on.map((d) => `"${d}"`).join(', ')}]`,
      `    group: "${t.group}"`,
      `    milestone: ${t.milestone}`,
    ];
    return lines.join('\n');
  });
  return project + 'tasks:\n' + taskLines.join('\n');
}

describe('loader', () => {
  beforeEach(() => {
    mkdirSync(FIXTURE_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
  });

  describe('loadTasks', () => {
    it('should parse valid YAML and return project and tasks', () => {
      // Given
      const yaml = buildYaml([VALID_TASK], 'My Project');
      writeYaml('valid.yaml', yaml);

      // When
      const result = loadTasks(yamlPath('valid.yaml'));

      // Then
      assert.equal(result.project.name, 'My Project');
      assert.equal(result.tasks.length, 1);
      assert.equal(result.tasks[0].id, 'task-1');
      assert.equal(result.tasks[0].name, 'Design');
      assert.equal(result.tasks[0].assignee, 'Tanaka');
      assert.equal(result.tasks[0].effort, 3);
      assert.equal(result.tasks[0].start_date, '2026-04-10');
      assert.equal(result.tasks[0].end_date, '2026-04-14');
      assert.equal(result.tasks[0].progress, 0);
      assert.deepEqual(result.tasks[0].depends_on, []);
      assert.equal(result.tasks[0].group, 'Planning');
      assert.equal(result.tasks[0].milestone, false);
    });

    it('should parse multiple tasks', () => {
      // Given
      const task2 = {
        ...VALID_TASK,
        id: 'task-2',
        name: 'Implementation',
        depends_on: ['task-1'],
      };
      const yaml = buildYaml([VALID_TASK, task2]);
      writeYaml('multi.yaml', yaml);

      // When
      const result = loadTasks(yamlPath('multi.yaml'));

      // Then
      assert.equal(result.tasks.length, 2);
      assert.equal(result.tasks[1].id, 'task-2');
      assert.deepEqual(result.tasks[1].depends_on, ['task-1']);
    });

    it('should throw when file does not exist', () => {
      // Given
      const nonExistentPath = yamlPath('nonexistent.yaml');

      // When / Then
      assert.throws(
        () => loadTasks(nonExistentPath),
        (err) => err instanceof Error
      );
    });

    it('should throw when YAML is malformed', () => {
      // Given
      writeYaml('malformed.yaml', ':\n  - :\n    invalid: [');

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('malformed.yaml')),
        (err) => err instanceof Error
      );
    });

    it('should throw when project field is missing', () => {
      // Given
      const yaml = 'tasks:\n  - id: "t1"\n    name: "X"\n    assignee: "A"\n    effort: 1\n    start_date: "2026-04-10"\n    end_date: "2026-04-11"\n    progress: 0\n    depends_on: []\n    group: "G"\n    milestone: false';
      writeYaml('no-project.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('no-project.yaml')),
        (err) => err instanceof Error
      );
    });

    it('should throw when tasks field is missing', () => {
      // Given
      const yaml = 'project:\n  name: "Test"';
      writeYaml('no-tasks.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('no-tasks.yaml')),
        (err) => err instanceof Error
      );
    });

    it('should throw when tasks is empty array', () => {
      // Given
      const yaml = 'project:\n  name: "Test"\ntasks: []';
      writeYaml('empty-tasks.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('empty-tasks.yaml')),
        (err) => err instanceof Error
      );
    });

    it('should throw when required field id is missing from task', () => {
      // Given
      const yaml = [
        'project:',
        '  name: "Test"',
        'tasks:',
        '  - name: "No ID"',
        '    assignee: "A"',
        '    effort: 1',
        '    start_date: "2026-04-10"',
        '    end_date: "2026-04-11"',
        '    progress: 0',
        '    depends_on: []',
        '    group: "G"',
        '    milestone: false',
      ].join('\n');
      writeYaml('no-id.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('no-id.yaml')),
        (err) => err instanceof Error
      );
    });

    it('should throw when required field name is missing from task', () => {
      // Given
      const yaml = [
        'project:',
        '  name: "Test"',
        'tasks:',
        '  - id: "t1"',
        '    assignee: "A"',
        '    effort: 1',
        '    start_date: "2026-04-10"',
        '    end_date: "2026-04-11"',
        '    progress: 0',
        '    depends_on: []',
        '    group: "G"',
        '    milestone: false',
      ].join('\n');
      writeYaml('no-name.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('no-name.yaml')),
        (err) => err instanceof Error
      );
    });

    it('should throw when start_date has invalid format', () => {
      // Given
      const task = { ...VALID_TASK, start_date: 'not-a-date' };
      writeYaml('bad-date.yaml', buildYaml([task]));

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-date.yaml')),
        (err) => err instanceof Error
      );
    });

    it('should throw when progress is not a number', () => {
      // Given
      const yaml = [
        'project:',
        '  name: "Test"',
        'tasks:',
        '  - id: "t1"',
        '    name: "Task"',
        '    assignee: "A"',
        '    effort: 1',
        '    start_date: "2026-04-10"',
        '    end_date: "2026-04-11"',
        '    progress: "high"',
        '    depends_on: []',
        '    group: "G"',
        '    milestone: false',
      ].join('\n');
      writeYaml('bad-progress.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-progress.yaml')),
        (err) => err instanceof Error
      );
    });

    it('should throw when progress is below 0', () => {
      // Given
      const task = { ...VALID_TASK, progress: -1 };
      writeYaml('neg-progress.yaml', buildYaml([task]));

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('neg-progress.yaml')),
        (err) => err instanceof Error
      );
    });

    it('should throw when progress is above 100', () => {
      // Given
      const task = { ...VALID_TASK, progress: 101 };
      writeYaml('over-progress.yaml', buildYaml([task]));

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('over-progress.yaml')),
        (err) => err instanceof Error
      );
    });

    it('should throw when duplicate task IDs exist', () => {
      // Given
      const dup = { ...VALID_TASK, name: 'Duplicate' };
      writeYaml('dup-ids.yaml', buildYaml([VALID_TASK, dup]));

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('dup-ids.yaml')),
        (err) => err instanceof Error
      );
    });

    it('should throw when effort is not a positive number', () => {
      // Given
      const task = { ...VALID_TASK, effort: 0 };
      writeYaml('zero-effort.yaml', buildYaml([task]));

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('zero-effort.yaml')),
        (err) => err instanceof Error
      );
    });
  });
});
