/** The label value every value past the limit is folded into. */
export const OTHER_LABEL_VALUE = 'other';

const DEFAULT_DISTINCT_VALUES = 100;

/** Returns a mapper that passes the first `limit` distinct values through and folds the rest into `other`. */
export function createBoundedLabel(limit: number = DEFAULT_DISTINCT_VALUES): (value: string) => string {
  const seen = new Set<string>();
  return (value) => {
    if (seen.has(value)) return value;
    if (seen.size >= limit) return OTHER_LABEL_VALUE;
    seen.add(value);
    return value;
  };
}
