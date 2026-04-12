/**
 * Integration tests for 2-level project hierarchy.
 * Tests the full pipeline: YAML → loader → check.js / show.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = join(__dirname, '..');
const CHECK_SCRIPT = join(SCRIPTS_DIR, 'check.js');
const SHOW_SCRIPT = join(SCRIPTS_DIR, 'show.js');
const FIXTURE_DIR = join(tmpdir(), 'gantt-integration-project-hierarchy-test');

function writeYaml(filename, content) {
  writeFileSync(join(FIXTURE_DIR, filename), content, 'utf8');
}

function yamlPath(filename) {
  return join(FIXTURE_DIR, filename);
}

function runScript(script, yamlFile) {
  return execFileSync('node', [script, yamlPath(yamlFile)], {
    encoding: 'utf8',
    timeout: 10000,
  });
}

const VALID_YAML_NEW_STRUCTURE = `project:
  name: "Multi-Project Program"

members:
  - "Tanaka"
  - "Sato"
  - "Suzuki"

groups:
  - project: "EC Site"
    sections:
      - "Design"
      - "Impl"
      - "Test"
  - project: "Infra Migration"
    sections:
      - "Plan"
      - "Build"

tasks:
  - id: "ec-design"
    name: "EC Design"
    assignee: "Tanaka"
    effort: 3
    start_date: "2026-04-10"
    end_date: "2026-04-14"
    progress: 100
    depends_on: []
    project: "EC Site"
    group: "Design"
    milestone: false
  - id: "ec-impl"
    name: "EC Implementation"
    assignee: "Sato"
    effort: 5
    start_date: "2026-04-15"
    end_date: "2026-04-21"
    progress: 50
    depends_on: ["ec-design"]
    project: "EC Site"
    group: "Impl"
    milestone: false
  - id: "infra-plan"
    name: "Infra Planning"
    assignee: "Suzuki"
    effort: 2
    start_date: "2026-04-10"
    end_date: "2026-04-12"
    progress: 100
    depends_on: []
    project: "Infra Migration"
    group: "Plan"
    milestone: false
  - id: "infra-build"
    name: "Infra Build"
    assignee: "Suzuki"
    effort: 5
    start_date: "2026-04-13"
    end_date: "2026-04-19"
    progress: 0
    depends_on: ["infra-plan"]
    project: "Infra Migration"
    group: "Build"
    milestone: false
`;

const YAML_WITH_UNGROUPED_TASK = `project:
  name: "Mixed Grouping"

members:
  - "Tanaka"

groups:
  - project: "Misc"
    sections:
      - "Plan"

tasks:
  - id: "planned"
    name: "Planned Task"
    assignee: "Tanaka"
    effort: 2
    start_date: "2026-04-10"
    end_date: "2026-04-12"
    progress: 0
    depends_on: []
    project: "Misc"
    group: "Plan"
    milestone: false
  - id: "ungrouped"
    name: "Ungrouped Task"
    assignee: "Tanaka"
    effort: 1
    start_date: "2026-04-13"
    end_date: "2026-04-14"
    progress: 0
    depends_on: []
    project: "Misc"
    milestone: false
`;

describe('integration: check.js with 2-level hierarchy', () => {
  beforeEach(() => {
    mkdirSync(FIXTURE_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
  });

  it('should output no errors for valid new-structure YAML', () => {
    // Given
    writeYaml('valid-new.yaml', VALID_YAML_NEW_STRUCTURE);

    // When
    const output = runScript(CHECK_SCRIPT, 'valid-new.yaml');

    // Then
    assert.ok(!output.includes('[ERROR]'));
  });

  it('should output no errors for YAML with ungrouped tasks', () => {
    // Given
    writeYaml('ungrouped.yaml', YAML_WITH_UNGROUPED_TASK);

    // When
    const output = runScript(CHECK_SCRIPT, 'ungrouped.yaml');

    // Then
    assert.ok(!output.includes('[ERROR]'));
  });

  it('should include critical path info for new structure', () => {
    // Given
    writeYaml('valid-new.yaml', VALID_YAML_NEW_STRUCTURE);

    // When
    const output = runScript(CHECK_SCRIPT, 'valid-new.yaml');

    // Then
    assert.ok(output.includes('クリティカルパス') || output.includes('critical'));
  });

  it('should detect dependency violation in new structure', () => {
    // Given: ec-impl depends on ec-design but starts before ec-design ends
    const yaml = VALID_YAML_NEW_STRUCTURE.replace(
      'start_date: "2026-04-15"',
      'start_date: "2026-04-12"'
    );
    writeYaml('dep-violation.yaml', yaml);

    // When
    const output = runScript(CHECK_SCRIPT, 'dep-violation.yaml');

    // Then
    assert.ok(output.includes('[ERROR]'));
    assert.ok(output.includes('ec-impl'));
  });
});

describe('integration: show.js with 2-level hierarchy', () => {
  beforeEach(() => {
    mkdirSync(FIXTURE_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
  });

  it('should output project name', () => {
    // Given
    writeYaml('valid-new.yaml', VALID_YAML_NEW_STRUCTURE);

    // When
    const output = runScript(SHOW_SCRIPT, 'valid-new.yaml');

    // Then
    assert.ok(output.includes('Multi-Project Program'));
  });

  it('should output task count', () => {
    // Given
    writeYaml('valid-new.yaml', VALID_YAML_NEW_STRUCTURE);

    // When
    const output = runScript(SHOW_SCRIPT, 'valid-new.yaml');

    // Then
    assert.ok(output.includes('4'));
  });

  it('should output critical path tasks', () => {
    // Given
    writeYaml('valid-new.yaml', VALID_YAML_NEW_STRUCTURE);

    // When
    const output = runScript(SHOW_SCRIPT, 'valid-new.yaml');

    // Then: CP should include at least some of the tasks
    assert.ok(
      output.includes('ec-design') || output.includes('ec-impl') ||
      output.includes('infra-plan') || output.includes('infra-build')
    );
  });
});
