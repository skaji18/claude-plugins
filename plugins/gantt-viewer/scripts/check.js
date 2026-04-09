import { loadTasks } from './lib/loader.js';
import { runAllChecks } from './lib/validator.js';
import { calculateCriticalPath } from './lib/critical-path.js';
import { formatCheckResults } from './lib/formatter.js';

const yamlPath = process.argv[2];
if (!yamlPath) {
  process.stderr.write('Usage: node check.js <yaml-path>\n');
  process.exit(1);
}

const { tasks } = loadTasks(yamlPath);
const today = new Date().toISOString().slice(0, 10);
const results = runAllChecks(tasks, today);

try {
  const cp = calculateCriticalPath(tasks);
  results.push({
    level: 'INFO',
    type: 'critical_path',
    taskId: null,
    message: `クリティカルパス: ${cp.path.join(' → ')} (合計 ${cp.totalDays} 日)`,
  });
} catch (err) {
  results.push({
    level: 'ERROR',
    type: 'critical_path_error',
    taskId: null,
    message: `クリティカルパス算出失敗: ${err.message}`,
  });
}

process.stdout.write(formatCheckResults(results) + '\n');
