import { loadTasks } from './lib/loader.js';
import { calculateCriticalPath } from './lib/critical-path.js';
import { formatSummary } from './lib/formatter.js';

const yamlPath = process.argv[2];
if (!yamlPath) {
  process.stderr.write('Usage: node show.js <yaml-path>\n');
  process.exit(1);
}

const { project, tasks } = loadTasks(yamlPath);
const today = new Date().toISOString().slice(0, 10);
const criticalPath = calculateCriticalPath(tasks);

process.stdout.write(formatSummary(project, tasks, criticalPath, today) + '\n');
