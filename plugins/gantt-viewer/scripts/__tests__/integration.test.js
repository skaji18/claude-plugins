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
const FIXTURE_DIR = join(tmpdir(), 'gantt-integration-test');

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

const VALID_YAML = `project:
  name: "Integration Test Project"

members:
  - "Tanaka"
  - "Sato"
  - "Suzuki"

groups:
  - project: "Planning"
    sections:
      - "Analysis"
  - project: "Development"
    sections:
      - "Coding"
  - project: "QA"
    sections:
      - "Testing"

tasks:
  - id: "design"
    name: "Design"
    assignee: "Tanaka"
    effort: 3
    start_date: "2026-04-10"
    end_date: "2026-04-14"
    progress: 100
    depends_on: []
    project: "Planning"
    group: "Analysis"
    milestone: false
  - id: "impl"
    name: "Implementation"
    assignee: "Sato"
    effort: 5
    start_date: "2026-04-15"
    end_date: "2026-04-21"
    progress: 50
    depends_on: ["design"]
    project: "Development"
    group: "Coding"
    milestone: false
  - id: "test"
    name: "Testing"
    assignee: "Suzuki"
    effort: 3
    start_date: "2026-04-22"
    end_date: "2026-04-25"
    progress: 0
    depends_on: ["impl"]
    project: "QA"
    group: "Testing"
    milestone: false
`;

const YAML_WITH_ERRORS = `project:
  name: "Error Project"

members:
  - "Tanaka"
  - "Sato"
  - "Admin"

groups:
  - project: "Planning"
    sections:
      - "Analysis"
  - project: "Development"
    sections:
      - "Coding"
  - project: "Release"
    sections:
      - "Deploy"

tasks:
  - id: "design"
    name: "Design"
    assignee: "Tanaka"
    effort: 3
    start_date: "2026-04-10"
    end_date: "2026-04-14"
    progress: 0
    depends_on: []
    project: "Planning"
    group: "Analysis"
    milestone: false
  - id: "impl"
    name: "Implementation"
    assignee: "Sato"
    effort: 5
    start_date: "2026-04-12"
    end_date: "2026-04-10"
    progress: 0
    depends_on: ["design"]
    project: "Development"
    group: "Coding"
    milestone: false
  - id: "deploy"
    name: "Deploy"
    assignee: "Admin"
    effort: 1
    start_date: "2026-04-20"
    end_date: "2026-04-20"
    progress: 0
    depends_on: ["revieww"]
    project: "Release"
    group: "Deploy"
    milestone: false
`;

describe('integration: check.js', () => {
  beforeEach(() => {
    mkdirSync(FIXTURE_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
  });

  it('should output no errors for valid YAML', () => {
    // Given
    writeYaml('valid.yaml', VALID_YAML);

    // When
    const output = runScript(CHECK_SCRIPT, 'valid.yaml');

    // Then
    assert.ok(!output.includes('[ERROR]'));
  });

  it('should detect dependency violation, date contradiction, and invalid reference', () => {
    // Given
    writeYaml('errors.yaml', YAML_WITH_ERRORS);

    // When
    const output = runScript(CHECK_SCRIPT, 'errors.yaml');

    // Then
    assert.ok(output.includes('[ERROR]'));
    // Date contradiction: impl start > end
    assert.ok(output.includes('impl'));
    // Invalid reference: deploy depends on "revieww"
    assert.ok(output.includes('revieww'));
  });

  it('should include critical path info', () => {
    // Given
    writeYaml('valid.yaml', VALID_YAML);

    // When
    const output = runScript(CHECK_SCRIPT, 'valid.yaml');

    // Then
    assert.ok(output.includes('クリティカルパス') || output.includes('critical'));
  });

  it('should exit with error when no YAML path provided', () => {
    // When / Then
    assert.throws(
      () => execFileSync('node', [CHECK_SCRIPT], { encoding: 'utf8', timeout: 10000 }),
      (err) => err.status !== 0
    );
  });

  it('should exit with error when YAML file does not exist', () => {
    // When / Then
    assert.throws(
      () => runScript(CHECK_SCRIPT, 'nonexistent.yaml'),
      (err) => err.status !== 0
    );
  });

  it('should report critical path error instead of swallowing it', () => {
    // Given: circular dependency makes critical path calculation fail
    const yaml = `project:
  name: "Circular"

members:
  - "X"
  - "Y"

groups:
  - project: "P"
    sections:
      - "G"

tasks:
  - id: "a"
    name: "A"
    assignee: "X"
    effort: 1
    start_date: "2026-04-10"
    end_date: "2026-04-11"
    progress: 0
    depends_on: ["b"]
    project: "P"
    group: "G"
    milestone: false
  - id: "b"
    name: "B"
    assignee: "Y"
    effort: 1
    start_date: "2026-04-10"
    end_date: "2026-04-11"
    progress: 0
    depends_on: ["a"]
    project: "P"
    group: "G"
    milestone: false
`;
    writeYaml('circular.yaml', yaml);

    // When
    const output = runScript(CHECK_SCRIPT, 'circular.yaml');

    // Then: error is reported, not swallowed
    assert.ok(output.includes('[ERROR]'));
    assert.ok(output.includes('クリティカルパス算出失敗'));
  });
});

describe('integration: show.js', () => {
  beforeEach(() => {
    mkdirSync(FIXTURE_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
  });

  it('should output project name', () => {
    // Given
    writeYaml('valid.yaml', VALID_YAML);

    // When
    const output = runScript(SHOW_SCRIPT, 'valid.yaml');

    // Then
    assert.ok(output.includes('Integration Test Project'));
  });

  it('should output task count', () => {
    // Given
    writeYaml('valid.yaml', VALID_YAML);

    // When
    const output = runScript(SHOW_SCRIPT, 'valid.yaml');

    // Then
    assert.ok(output.includes('3'));
  });

  it('should output critical path', () => {
    // Given
    writeYaml('valid.yaml', VALID_YAML);

    // When
    const output = runScript(SHOW_SCRIPT, 'valid.yaml');

    // Then
    assert.ok(output.includes('design'));
    assert.ok(output.includes('impl'));
    assert.ok(output.includes('test'));
  });

  it('should exit with error when no YAML path provided', () => {
    // When / Then
    assert.throws(
      () => execFileSync('node', [SHOW_SCRIPT], { encoding: 'utf8', timeout: 10000 }),
      (err) => err.status !== 0
    );
  });

  it('should exit with error when YAML file does not exist', () => {
    // When / Then
    assert.throws(
      () => runScript(SHOW_SCRIPT, 'nonexistent.yaml'),
      (err) => err.status !== 0
    );
  });
});
