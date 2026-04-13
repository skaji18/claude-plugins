import { readFileSync } from 'node:fs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';

const args = process.argv.slice(2);
const serveFlag = args.includes('--serve');
const yamlPath = args.find(a => !a.startsWith('--'));
if (!yamlPath) {
  process.stderr.write('Usage: node open.js <yaml-path> [--serve]\n');
  process.exit(1);
}

// Resolve plugin root (templates directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pluginRoot = dirname(__dirname);
const templatesDir = join(pluginRoot, 'templates');

// 1. Read and parse the YAML file
const yamlContent = readFileSync(yamlPath, 'utf8');
const ganttData = yaml.load(yamlContent);

// 2. Read template files
const htmlTemplate = readFileSync(join(templatesDir, 'gantt.html'), 'utf8');
const coreJs = readFileSync(join(templatesDir, 'gantt-core.js'), 'utf8');
const renderJs = readFileSync(join(templatesDir, 'gantt-render.js'), 'utf8');
const uiJs = readFileSync(join(templatesDir, 'gantt-ui.js'), 'utf8');

// 3. Build self-contained HTML
// - Remove the js-yaml CDN script tag (no longer needed since data is pre-parsed JSON)
// - Remove the external JS script tags and the init call
// - Inline everything

// Remove js-yaml CDN script tag
let html = htmlTemplate.replace(
  /\s*<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/js-yaml[^"]*"[^>]*><\/script>\n?/,
  '\n'
);

// Replace the external script tags and init call with inlined versions
html = html.replace(
  /\s*<script src="gantt-core\.js"><\/script>\s*\n\s*<script src="gantt-render\.js"><\/script>\s*\n\s*<script src="gantt-ui\.js"><\/script>\s*\n\s*<script>\s*\n\s*GanttRender\.init\('gantt\.yaml'\);\s*\n\s*<\/script>/,
  `
  <script>
${coreJs}
  </script>
  <script>
${renderJs}
  </script>
  <script>
${uiJs}
  </script>
  <script>
    const GANTT_DATA = ${JSON.stringify(ganttData)};
    GanttRender.initWithData(GANTT_DATA);
  </script>`
);

// 4. Write to temp directory
const timestamp = Date.now();
const tmpDir = `/tmp/gantt-${timestamp}`;
mkdirSync(tmpDir, { recursive: true });
const tmpPath = join(tmpDir, 'index.html');
writeFileSync(tmpPath, html, 'utf8');

if (serveFlag) {
  // 5a. --serve mode: start npx serve and stream output
  process.stdout.write(`ガントチャートを配信します: ${tmpDir}\n`);
  const serve = spawn('npx', ['serve', tmpDir, '--no-clipboard'], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  serve.on('error', (err) => {
    process.stderr.write(`serve の起動に失敗しました: ${err.message}\n`);
    process.exit(1);
  });
  serve.on('exit', (code) => {
    process.exit(code ?? 0);
  });
} else {
  // 5b. Normal mode: open in browser
  const platform = process.platform;
  try {
    if (platform === 'darwin') {
      execSync(`open "${tmpPath}"`);
    } else if (platform === 'linux') {
      execSync(`xdg-open "${tmpPath}"`);
    } else if (platform === 'win32') {
      execSync(`start "" "${tmpPath}"`);
    } else {
      process.stdout.write(`ブラウザで以下のファイルを開いてください:\n${tmpPath}\n`);
      process.exit(0);
    }
    process.stdout.write(`ガントチャートをブラウザで開きました: ${tmpPath}\n`);
  } catch {
    process.stdout.write(`ブラウザの自動起動に失敗しました。以下のファイルを手動で開いてください:\n${tmpPath}\n`);
  }
}
