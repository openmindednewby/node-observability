const STANDARD = 'BaseClient/docs/code-standards/observability-pillars.md section 7 "Few metric labels"';
const HTTP_METRIC_PREFIX = 'http_';
const TENANT_LABEL = 'tenant';

/** The most labels one metric may declare. */
export const MAX_LABELS_PER_METRIC = 8;

/** Label names never allowed on a metric: they belong in logs and span attributes. */
export const BANNED_METRIC_LABELS: readonly string[] = [
  'user_id', 'userid', 'user', 'email',
  'request_id', 'trace_id', 'span_id', 'correlation_id',
  'path', 'url', 'raw_path', 'query',
  'ip', 'client_ip', 'user_agent',
  'message', 'error_message',
];

const banned = new Set(BANNED_METRIC_LABELS);

function refuse(name: string, reason: string): never {
  throw new Error(`Metric "${name}": ${reason}. See ${STANDARD}.`);
}

/** Throws when a metric's label names break the label rules (banned name, tenant on http_*, over budget). */
export function assertMetricLabels(name: string, labelNames: readonly string[]): void {
  if (labelNames.length > MAX_LABELS_PER_METRIC) refuse(name, `declares ${labelNames.length} labels, at most ${MAX_LABELS_PER_METRIC} labels are allowed`);
  for (const label of labelNames) {
    const key = label.toLowerCase();
    if (banned.has(key)) refuse(name, `label "${label}" is banned (unbounded or personal data)`);
    if (key === TENANT_LABEL && name.startsWith(HTTP_METRIC_PREFIX)) refuse(name, `label "${label}" is not allowed on http_* metrics`);
  }
}
