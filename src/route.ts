/** Route label for every path that matches no template, as in Metrics.Client. */
export const UNMATCHED_ROUTE = 'unmatched';

/** Strips the query string and trailing slashes from a request URL. */
export function normalisePath(url: string | undefined): string {
  const path = (url ?? '/').split('?')[0] ?? '/';
  return path.replace(/\/+$/, '') || '/';
}

function segmentMatches(template: string, actual: string | undefined): boolean {
  if (template.startsWith(':')) return actual !== undefined && actual !== '';
  return template === actual;
}

/** Builds a resolver that maps a request URL to its route template or `unmatched`. */
export function matchRoute(templates: readonly string[]): (url: string | undefined) => string {
  const compiled = templates.map((template) => ({ template, parts: normalisePath(template).split('/') }));
  return (url) => {
    const parts = normalisePath(url).split('/');
    const hit = compiled.find((c) => c.parts.length === parts.length && c.parts.every((s, i) => segmentMatches(s, parts[i])));
    return hit?.template ?? UNMATCHED_ROUTE;
  };
}
