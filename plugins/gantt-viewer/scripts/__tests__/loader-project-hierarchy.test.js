import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { loadTasks } from '../lib/loader.js';

const FIXTURE_DIR = join(tmpdir(), 'gantt-loader-project-hierarchy-test');

function writeYaml(filename, content) {
  writeFileSync(join(FIXTURE_DIR, filename), content, 'utf8');
}

function yamlPath(filename) {
  return join(FIXTURE_DIR, filename);
}

/**
 * Build a YAML string with new 2-level groups structure.
 * groups: [{project, sections}], tasks have project (required) + group (optional).
 */
function buildYaml(tasks, options) {
  const projectName = (options && options.projectName) || 'Test Program';
  const members = (options && options.members) || [...new Set(tasks.map((t) => t.assignee))];
  const groups = (options && options.groups) || [
    { project: 'ProjectA', sections: ['Design', 'Impl'] },
  ];

  const lines = [];
  lines.push(`project:`);
  lines.push(`  name: "${projectName}"`);
  lines.push('');

  if (!options || !options.skipMembers) {
    lines.push('members:');
    for (const m of members) {
      lines.push(`  - "${m}"`);
    }
  }

  if (!options || !options.skipGroups) {
    lines.push('groups:');
    for (const g of groups) {
      lines.push(`  - project: "${g.project}"`);
      lines.push('    sections:');
      for (const s of g.sections) {
        lines.push(`      - "${s}"`);
      }
    }
  }

  lines.push('tasks:');
  for (const t of tasks) {
    lines.push(`  - id: "${t.id}"`);
    lines.push(`    name: "${t.name}"`);
    lines.push(`    assignee: "${t.assignee}"`);
    lines.push(`    effort: ${t.effort}`);
    lines.push(`    start_date: "${t.start_date}"`);
    lines.push(`    end_date: "${t.end_date}"`);
    lines.push(`    progress: ${t.progress}`);
    lines.push(`    depends_on: [${t.depends_on.map((d) => `"${d}"`).join(', ')}]`);
    lines.push(`    project: "${t.project}"`);
    if (t.group !== undefined) {
      lines.push(`    group: "${t.group}"`);
    }
    lines.push(`    milestone: ${t.milestone}`);
  }

  return lines.join('\n');
}

const VALID_TASK = {
  id: 'task-1',
  name: 'Design Doc',
  assignee: 'Tanaka',
  effort: 3,
  start_date: '2026-04-10',
  end_date: '2026-04-14',
  progress: 0,
  depends_on: [],
  project: 'ProjectA',
  group: 'Design',
  milestone: false,
};

describe('loader: 2-level project hierarchy', () => {
  beforeEach(() => {
    mkdirSync(FIXTURE_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
  });

  // --- groups structure validation ---

  describe('groups structure validation', () => {
    it('should parse new groups structure [{project, sections}]', () => {
      // Given
      const groups = [
        { project: 'EC Site', sections: ['Design', 'Impl', 'Test'] },
        { project: 'Infra', sections: ['Plan', 'Build'] },
      ];
      const task1 = { ...VALID_TASK, project: 'EC Site', group: 'Design' };
      const yaml = buildYaml([task1], { groups, members: ['Tanaka'] });
      writeYaml('valid-groups.yaml', yaml);

      // When
      const result = loadTasks(yamlPath('valid-groups.yaml'));

      // Then
      assert.ok(Array.isArray(result.groups));
      assert.equal(result.groups.length, 2);
      assert.equal(result.groups[0].project, 'EC Site');
      assert.deepEqual(result.groups[0].sections, ['Design', 'Impl', 'Test']);
      assert.equal(result.groups[1].project, 'Infra');
      assert.deepEqual(result.groups[1].sections, ['Plan', 'Build']);
    });

    it('should throw when groups is missing', () => {
      // Given
      const yaml = buildYaml([VALID_TASK], { skipGroups: true, members: ['Tanaka'] });
      writeYaml('no-groups.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('no-groups.yaml')),
        (err) => err.message.includes('groups')
      );
    });

    it('should throw when groups is an empty array', () => {
      // Given
      const yaml = [
        'project:',
        '  name: "Test"',
        'members:',
        '  - "Tanaka"',
        'groups: []',
        'tasks:',
        '  - id: "t1"',
        '    name: "X"',
        '    assignee: "Tanaka"',
        '    effort: 1',
        '    start_date: "2026-04-10"',
        '    end_date: "2026-04-11"',
        '    progress: 0',
        '    depends_on: []',
        '    project: "A"',
        '    milestone: false',
      ].join('\n');
      writeYaml('empty-groups.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('empty-groups.yaml')),
        (err) => err.message.includes('groups')
      );
    });

    it('should throw when groups entry is missing project field', () => {
      // Given
      const yaml = [
        'project:',
        '  name: "Test"',
        'members:',
        '  - "Tanaka"',
        'groups:',
        '  - sections:',
        '      - "Design"',
        'tasks:',
        '  - id: "t1"',
        '    name: "X"',
        '    assignee: "Tanaka"',
        '    effort: 1',
        '    start_date: "2026-04-10"',
        '    end_date: "2026-04-11"',
        '    progress: 0',
        '    depends_on: []',
        '    project: "A"',
        '    milestone: false',
      ].join('\n');
      writeYaml('no-project-in-group.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('no-project-in-group.yaml')),
        (err) => err.message.includes('project')
      );
    });

    it('should throw when groups entry is missing sections field', () => {
      // Given
      const yaml = [
        'project:',
        '  name: "Test"',
        'members:',
        '  - "Tanaka"',
        'groups:',
        '  - project: "EC Site"',
        'tasks:',
        '  - id: "t1"',
        '    name: "X"',
        '    assignee: "Tanaka"',
        '    effort: 1',
        '    start_date: "2026-04-10"',
        '    end_date: "2026-04-11"',
        '    progress: 0',
        '    depends_on: []',
        '    project: "EC Site"',
        '    milestone: false',
      ].join('\n');
      writeYaml('no-sections.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('no-sections.yaml')),
        (err) => err.message.includes('sections')
      );
    });

    it('should throw when sections is an empty array', () => {
      // Given
      const yaml = [
        'project:',
        '  name: "Test"',
        'members:',
        '  - "Tanaka"',
        'groups:',
        '  - project: "EC Site"',
        '    sections: []',
        'tasks:',
        '  - id: "t1"',
        '    name: "X"',
        '    assignee: "Tanaka"',
        '    effort: 1',
        '    start_date: "2026-04-10"',
        '    end_date: "2026-04-11"',
        '    progress: 0',
        '    depends_on: []',
        '    project: "EC Site"',
        '    milestone: false',
      ].join('\n');
      writeYaml('empty-sections.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('empty-sections.yaml')),
        (err) => err.message.includes('sections')
      );
    });

    it('should throw when duplicate project names exist in groups', () => {
      // Given
      const yaml = [
        'project:',
        '  name: "Test"',
        'members:',
        '  - "Tanaka"',
        'groups:',
        '  - project: "EC Site"',
        '    sections:',
        '      - "Design"',
        '  - project: "EC Site"',
        '    sections:',
        '      - "Impl"',
        'tasks:',
        '  - id: "t1"',
        '    name: "X"',
        '    assignee: "Tanaka"',
        '    effort: 1',
        '    start_date: "2026-04-10"',
        '    end_date: "2026-04-11"',
        '    progress: 0',
        '    depends_on: []',
        '    project: "EC Site"',
        '    group: "Design"',
        '    milestone: false',
      ].join('\n');
      writeYaml('dup-project.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('dup-project.yaml')),
        (err) => err.message.includes('EC Site')
      );
    });

    it('should throw when sections contains non-string element', () => {
      // Given
      const yaml = [
        'project:',
        '  name: "Test"',
        'members:',
        '  - "Tanaka"',
        'groups:',
        '  - project: "EC Site"',
        '    sections:',
        '      - 123',
        'tasks:',
        '  - id: "t1"',
        '    name: "X"',
        '    assignee: "Tanaka"',
        '    effort: 1',
        '    start_date: "2026-04-10"',
        '    end_date: "2026-04-11"',
        '    progress: 0',
        '    depends_on: []',
        '    project: "EC Site"',
        '    milestone: false',
      ].join('\n');
      writeYaml('bad-sections-type.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-sections-type.yaml')),
        (err) => err.message.includes('sections') && err.message.includes('string')
      );
    });
  });

  // --- task project field (required) ---

  describe('task project field', () => {
    it('should parse project field from task', () => {
      // Given
      const yaml = buildYaml([VALID_TASK], {
        groups: [{ project: 'ProjectA', sections: ['Design'] }],
        members: ['Tanaka'],
      });
      writeYaml('task-project.yaml', yaml);

      // When
      const result = loadTasks(yamlPath('task-project.yaml'));

      // Then
      assert.equal(result.tasks[0].project, 'ProjectA');
    });

    it('should throw when task is missing project field', () => {
      // Given: task without project
      const yaml = [
        'project:',
        '  name: "Test"',
        'members:',
        '  - "Tanaka"',
        'groups:',
        '  - project: "ProjectA"',
        '    sections:',
        '      - "Design"',
        'tasks:',
        '  - id: "t1"',
        '    name: "X"',
        '    assignee: "Tanaka"',
        '    effort: 1',
        '    start_date: "2026-04-10"',
        '    end_date: "2026-04-11"',
        '    progress: 0',
        '    depends_on: []',
        '    group: "Design"',
        '    milestone: false',
      ].join('\n');
      writeYaml('no-task-project.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('no-task-project.yaml')),
        (err) => err.message.includes('project')
      );
    });

    it('should throw when task project is not a string', () => {
      // Given
      const yaml = [
        'project:',
        '  name: "Test"',
        'members:',
        '  - "Tanaka"',
        'groups:',
        '  - project: "ProjectA"',
        '    sections:',
        '      - "Design"',
        'tasks:',
        '  - id: "t1"',
        '    name: "X"',
        '    assignee: "Tanaka"',
        '    effort: 1',
        '    start_date: "2026-04-10"',
        '    end_date: "2026-04-11"',
        '    progress: 0',
        '    depends_on: []',
        '    project: 123',
        '    milestone: false',
      ].join('\n');
      writeYaml('bad-project-type.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-project-type.yaml')),
        (err) => err.message.includes('project') && err.message.includes('string')
      );
    });
  });

  // --- task group field (optional) ---

  describe('task group field (optional)', () => {
    it('should accept task without group field', () => {
      // Given: task has project but no group
      const taskNoGroup = { ...VALID_TASK };
      delete taskNoGroup.group;
      const yaml = buildYaml([taskNoGroup], {
        groups: [{ project: 'ProjectA', sections: ['Design'] }],
        members: ['Tanaka'],
      });
      writeYaml('no-group.yaml', yaml);

      // When
      const result = loadTasks(yamlPath('no-group.yaml'));

      // Then
      assert.equal(result.tasks[0].group, undefined);
    });

    it('should accept task with group field', () => {
      // Given
      const yaml = buildYaml([VALID_TASK], {
        groups: [{ project: 'ProjectA', sections: ['Design'] }],
        members: ['Tanaka'],
      });
      writeYaml('with-group.yaml', yaml);

      // When
      const result = loadTasks(yamlPath('with-group.yaml'));

      // Then
      assert.equal(result.tasks[0].group, 'Design');
    });

    it('should throw when group is not a string', () => {
      // Given
      const yaml = [
        'project:',
        '  name: "Test"',
        'members:',
        '  - "Tanaka"',
        'groups:',
        '  - project: "ProjectA"',
        '    sections:',
        '      - "Design"',
        'tasks:',
        '  - id: "t1"',
        '    name: "X"',
        '    assignee: "Tanaka"',
        '    effort: 1',
        '    start_date: "2026-04-10"',
        '    end_date: "2026-04-11"',
        '    progress: 0',
        '    depends_on: []',
        '    project: "ProjectA"',
        '    group: 123',
        '    milestone: false',
      ].join('\n');
      writeYaml('bad-group-type.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-group-type.yaml')),
        (err) => err.message.includes('group') && err.message.includes('string')
      );
    });
  });

  // --- reference checks ---

  describe('reference checks', () => {
    it('should throw when task project is not in groups project list', () => {
      // Given
      const task = { ...VALID_TASK, project: 'Unknown' };
      const yaml = buildYaml([task], {
        groups: [{ project: 'ProjectA', sections: ['Design'] }],
        members: ['Tanaka'],
      });
      writeYaml('bad-project-ref.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-project-ref.yaml')),
        (err) => err.message.includes('project') && err.message.includes('Unknown')
      );
    });

    it('should throw when task group is not in corresponding project sections', () => {
      // Given: task references group "QA" but ProjectA only has ["Design", "Impl"]
      const task = { ...VALID_TASK, project: 'ProjectA', group: 'QA' };
      const yaml = buildYaml([task], {
        groups: [{ project: 'ProjectA', sections: ['Design', 'Impl'] }],
        members: ['Tanaka'],
      });
      writeYaml('bad-group-ref.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('bad-group-ref.yaml')),
        (err) => err.message.includes('group') && err.message.includes('QA')
      );
    });

    it('should accept task group that exists in the correct project sections', () => {
      // Given
      const task = { ...VALID_TASK, project: 'ProjectA', group: 'Impl' };
      const yaml = buildYaml([task], {
        groups: [{ project: 'ProjectA', sections: ['Design', 'Impl'] }],
        members: ['Tanaka'],
      });
      writeYaml('valid-group-ref.yaml', yaml);

      // When
      const result = loadTasks(yamlPath('valid-group-ref.yaml'));

      // Then
      assert.equal(result.tasks[0].group, 'Impl');
    });

    it('should not check group reference when group is omitted', () => {
      // Given: task has no group, no sections validation needed
      const taskNoGroup = { ...VALID_TASK };
      delete taskNoGroup.group;
      const yaml = buildYaml([taskNoGroup], {
        groups: [{ project: 'ProjectA', sections: ['Design'] }],
        members: ['Tanaka'],
      });
      writeYaml('no-group-no-ref-check.yaml', yaml);

      // When / Then: should not throw
      const result = loadTasks(yamlPath('no-group-no-ref-check.yaml'));
      assert.equal(result.tasks[0].group, undefined);
    });

    it('should validate group against correct project (not another projects sections)', () => {
      // Given: task belongs to ProjectB with group "Build",
      //   but "Build" exists in ProjectA's sections, not ProjectB's
      const task = { ...VALID_TASK, project: 'ProjectB', group: 'Build' };
      const yaml = buildYaml([task], {
        groups: [
          { project: 'ProjectA', sections: ['Build', 'Deploy'] },
          { project: 'ProjectB', sections: ['Plan', 'Execute'] },
        ],
        members: ['Tanaka'],
      });
      writeYaml('wrong-project-section.yaml', yaml);

      // When / Then
      assert.throws(
        () => loadTasks(yamlPath('wrong-project-section.yaml')),
        (err) => err.message.includes('group') && err.message.includes('Build')
      );
    });
  });

  // --- return value structure ---

  describe('return value', () => {
    it('should return groups in new structure', () => {
      // Given
      const groups = [
        { project: 'EC Site', sections: ['Design', 'Impl'] },
        { project: 'Infra', sections: ['Plan'] },
      ];
      const task = { ...VALID_TASK, project: 'EC Site', group: 'Design' };
      const yaml = buildYaml([task], { groups, members: ['Tanaka'] });
      writeYaml('return-groups.yaml', yaml);

      // When
      const result = loadTasks(yamlPath('return-groups.yaml'));

      // Then
      assert.deepEqual(result.groups, groups);
    });

    it('should return members as flat array', () => {
      // Given
      const yaml = buildYaml([VALID_TASK], {
        groups: [{ project: 'ProjectA', sections: ['Design'] }],
        members: ['Tanaka', 'Sato'],
      });
      writeYaml('members-flat.yaml', yaml);

      // When
      const result = loadTasks(yamlPath('members-flat.yaml'));

      // Then
      assert.deepEqual(result.members, ['Tanaka', 'Sato']);
    });
  });

  // --- multiple projects with mixed tasks ---

  describe('multi-project scenarios', () => {
    it('should parse tasks across multiple projects', () => {
      // Given
      const groups = [
        { project: 'EC Site', sections: ['Design', 'Impl'] },
        { project: 'Infra', sections: ['Plan', 'Build'] },
      ];
      const tasks = [
        { ...VALID_TASK, id: 't1', project: 'EC Site', group: 'Design' },
        { ...VALID_TASK, id: 't2', project: 'EC Site', group: 'Impl' },
        { ...VALID_TASK, id: 't3', project: 'Infra', group: 'Plan' },
      ];
      const yaml = buildYaml(tasks, { groups, members: ['Tanaka'] });
      writeYaml('multi-project.yaml', yaml);

      // When
      const result = loadTasks(yamlPath('multi-project.yaml'));

      // Then
      assert.equal(result.tasks.length, 3);
      assert.equal(result.tasks[0].project, 'EC Site');
      assert.equal(result.tasks[2].project, 'Infra');
    });

    it('should accept mix of tasks with and without group', () => {
      // Given
      const groups = [
        { project: 'EC Site', sections: ['Design'] },
      ];
      const taskWithGroup = { ...VALID_TASK, id: 't1', project: 'EC Site', group: 'Design' };
      const taskNoGroup = {
        id: 't2', name: 'Misc', assignee: 'Tanaka', effort: 1,
        start_date: '2026-04-15', end_date: '2026-04-16', progress: 0,
        depends_on: [], project: 'EC Site', milestone: false,
      };
      const yaml = buildYaml([taskWithGroup, taskNoGroup], { groups, members: ['Tanaka'] });
      writeYaml('mixed-group.yaml', yaml);

      // When
      const result = loadTasks(yamlPath('mixed-group.yaml'));

      // Then
      assert.equal(result.tasks[0].group, 'Design');
      assert.equal(result.tasks[1].group, undefined);
    });
  });
});
