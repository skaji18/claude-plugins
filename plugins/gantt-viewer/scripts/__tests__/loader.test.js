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

function buildYaml(tasks, projectName, options) {
  const project = `project:\n  name: "${projectName || 'Test Project'}"\n`;
  let extra = '';
  if (options && options.members) {
    extra += 'members:\n' + options.members.map((m) => `  - "${m}"`).join('\n') + '\n';
  }
  if (options && options.groups) {
    extra += 'groups:\n' + options.groups.map((g) => `  - "${g}"`).join('\n') + '\n';
  }
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
    if (t.blocked !== undefined) lines.push(`    blocked: ${t.blocked}`);
    if (t.notes !== undefined) lines.push(`    notes: "${t.notes}"`);
    if (t.tags !== undefined) lines.push(`    tags: [${t.tags.map((tag) => `"${tag}"`).join(', ')}]`);
    if (t.actual_start_date !== undefined) lines.push(`    actual_start_date: "${t.actual_start_date}"`);
    if (t.actual_end_date !== undefined) lines.push(`    actual_end_date: "${t.actual_end_date}"`);
    if (t.actual_effort !== undefined) lines.push(`    actual_effort: ${t.actual_effort}`);
    return lines.join('\n');
  });
  return project + extra + 'tasks:\n' + taskLines.join('\n');
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

    // --- New optional fields ---

    it('should parse optional fields (blocked, notes, tags, actual_*)', () => {
      // Given
      const task = {
        ...VALID_TASK,
        blocked: true,
        notes: 'waiting on external',
        tags: ['frontend', 'urgent'],
        actual_start_date: '2026-04-10',
        actual_end_date: '2026-04-13',
        actual_effort: 2.5,
      };
      writeYaml('optional-fields.yaml', buildYaml([task]));

      // When
      const result = loadTasks(yamlPath('optional-fields.yaml'));

      // Then
      assert.equal(result.tasks[0].blocked, true);
      assert.equal(result.tasks[0].notes, 'waiting on external');
      assert.deepEqual(result.tasks[0].tags, ['frontend', 'urgent']);
      assert.equal(result.tasks[0].actual_start_date, '2026-04-10');
      assert.equal(result.tasks[0].actual_end_date, '2026-04-13');
      assert.equal(result.tasks[0].actual_effort, 2.5);
    });

    it('should accept tasks without optional fields', () => {
      // Given
      writeYaml('no-optional.yaml', buildYaml([VALID_TASK]));

      // When
      const result = loadTasks(yamlPath('no-optional.yaml'));

      // Then
      assert.equal(result.tasks[0].blocked, undefined);
      assert.equal(result.tasks[0].notes, undefined);
      assert.equal(result.tasks[0].tags, undefined);
    });

    it('should throw when blocked is not a boolean', () => {
      // Given
      const yaml = buildYaml([VALID_TASK]).replace('milestone: false', 'milestone: false\n    blocked: "yes"');
      writeYaml('bad-blocked.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-blocked.yaml')),
        (err) => err.message.includes('blocked')
      );
    });

    it('should throw when notes is not a string', () => {
      // Given
      const yaml = buildYaml([VALID_TASK]).replace('milestone: false', 'milestone: false\n    notes: 123');
      writeYaml('bad-notes.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-notes.yaml')),
        (err) => err.message.includes('notes')
      );
    });

    it('should throw when tags is not an array of strings', () => {
      // Given
      const yaml = buildYaml([VALID_TASK]).replace('milestone: false', 'milestone: false\n    tags: [1, 2]');
      writeYaml('bad-tags.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-tags.yaml')),
        (err) => err.message.includes('tags')
      );
    });

    it('should throw when actual_start_date has invalid format', () => {
      // Given
      const yaml = buildYaml([VALID_TASK]).replace('milestone: false', 'milestone: false\n    actual_start_date: "bad"');
      writeYaml('bad-actual-start.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-actual-start.yaml')),
        (err) => err.message.includes('actual_start_date')
      );
    });

    it('should throw when actual_end_date has invalid format', () => {
      // Given
      const yaml = buildYaml([VALID_TASK]).replace('milestone: false', 'milestone: false\n    actual_end_date: "nope"');
      writeYaml('bad-actual-end.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-actual-end.yaml')),
        (err) => err.message.includes('actual_end_date')
      );
    });

    it('should throw when actual_effort is not a positive number', () => {
      // Given
      const yaml = buildYaml([VALID_TASK]).replace('milestone: false', 'milestone: false\n    actual_effort: -1');
      writeYaml('bad-actual-effort.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-actual-effort.yaml')),
        (err) => err.message.includes('actual_effort')
      );
    });

    // --- Members / Groups ---

    it('should parse members and groups sections', () => {
      // Given
      const yaml = buildYaml([VALID_TASK], 'Test', { members: ['Tanaka'], groups: ['Planning'] });
      writeYaml('with-members-groups.yaml', yaml);

      // When
      const result = loadTasks(yamlPath('with-members-groups.yaml'));

      // Then
      assert.deepEqual(result.members, ['Tanaka']);
      assert.deepEqual(result.groups, ['Planning']);
    });

    it('should return null for members and groups when not defined', () => {
      // Given
      writeYaml('no-members-groups.yaml', buildYaml([VALID_TASK]));

      // When
      const result = loadTasks(yamlPath('no-members-groups.yaml'));

      // Then
      assert.equal(result.members, null);
      assert.equal(result.groups, null);
    });

    it('should throw when assignee is not in members list', () => {
      // Given
      const yaml = buildYaml([VALID_TASK], 'Test', { members: ['Sato'] });
      writeYaml('bad-assignee-ref.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-assignee-ref.yaml')),
        (err) => err.message.includes('assignee') && err.message.includes('Tanaka')
      );
    });

    it('should throw when group is not in groups list', () => {
      // Given
      const yaml = buildYaml([VALID_TASK], 'Test', { members: ['Tanaka'], groups: ['Other'] });
      writeYaml('bad-group-ref.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-group-ref.yaml')),
        (err) => err.message.includes('group') && err.message.includes('Planning')
      );
    });

    it('should skip assignee check when members is not defined', () => {
      // Given: no members section, assignee can be anything
      writeYaml('no-members.yaml', buildYaml([VALID_TASK]));

      // When / Then: should not throw
      const result = loadTasks(yamlPath('no-members.yaml'));
      assert.equal(result.members, null);
    });
  });
});
