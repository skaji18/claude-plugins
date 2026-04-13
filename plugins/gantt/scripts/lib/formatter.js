const TYPE_LABELS = {
  dependency_violation: '依存違反',
  date_contradiction: '日付矛盾',
  invalid_reference: '無効参照',
  delayed: '遅延',
};

const LEVEL_ORDER = { ERROR: 0, WARN: 1, INFO: 2 };

function formatLine(result) {
  const levelTag = `[${result.level}]`.padEnd(7);
  const label = TYPE_LABELS[result.type];
  if (label) {
    return `${levelTag} ${label}: ${result.message}`;
  }
  return `${levelTag} ${result.message}`;
}

export function formatCheckResults(results) {
  if (results.length === 0) {
    return 'チェック結果: 問題なし';
  }

  const sorted = [...results].sort(
    (a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9)
  );

  const lines = sorted.map(formatLine);

  const errorCount = results.filter((r) => r.level === 'ERROR').length;
  const warnCount = results.filter((r) => r.level === 'WARN').length;

  const parts = [];
  if (errorCount > 0) parts.push(`ERROR ${errorCount}件`);
  if (warnCount > 0) parts.push(`WARN ${warnCount}件`);

  if (parts.length > 0) {
    lines.push('');
    lines.push(`チェック結果: ${parts.join(', ')}`);
  }

  return lines.join('\n');
}

export function formatSummary(project, tasks, criticalPath, today) {
  const lines = [];

  lines.push(`プロジェクト: ${project.name}`);
  lines.push(`タスク数: ${tasks.length}`);

  const completed = tasks.filter((t) => t.progress === 100);
  const inProgress = tasks.filter((t) => t.progress > 0 && t.progress < 100);
  const notStarted = tasks.filter((t) => t.progress === 0);

  const pct = (n) => Math.round((n / tasks.length) * 100);
  lines.push(
    `完了: ${completed.length} (${pct(completed.length)}%), ` +
    `進行中: ${inProgress.length} (${pct(inProgress.length)}%), ` +
    `未着手: ${notStarted.length} (${pct(notStarted.length)}%)`
  );

  const delayed = tasks.filter((t) => t.end_date < today && t.progress < 100);
  lines.push(`遅延タスク: ${delayed.length}件`);
  for (const task of delayed) {
    lines.push(`  - ${task.id} (担当: ${task.assignee}, 期限: ${task.end_date}, 進捗: ${task.progress}%)`);
  }

  lines.push(`クリティカルパス: ${criticalPath.path.join(' → ')}`);

  return lines.join('\n');
}
