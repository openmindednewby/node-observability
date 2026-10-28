import { randomBytes } from 'node:crypto';

/** The fields of an incoming W3C `traceparent` header. */
export interface TraceparentHeader {
  traceId: string;
  parentSpanId: string;
  flags: string;
}

/** The trace this process is handling: the caller's trace id and this request's own span id. */
export interface TraceContext {
  traceId: string;
  spanId: string;
  flags: string;
}

const TRACEPARENT = /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const INVALID_VERSION = 'ff';
const SAMPLED = '01';
const TRACE_ID_BYTES = 16;
const SPAN_ID_BYTES = 8;

const allZero = (hex: string): boolean => /^0+$/.test(hex);

/** Parses a W3C `traceparent` header; returns null when it is absent or invalid. */
export function parseTraceparent(header: string | undefined): TraceparentHeader | null {
  const m = TRACEPARENT.exec(header ?? '');
  if (!m) return null;
  const [, version, traceId, parentSpanId, flags] = m as unknown as [string, string, string, string, string];
  if (version === INVALID_VERSION || allZero(traceId) || allZero(parentSpanId)) return null;
  return { traceId, parentSpanId, flags };
}

/** Continues the caller's trace with a new span, or starts a new sampled trace. */
export function startTrace(header: string | undefined): TraceContext {
  const spanId = randomBytes(SPAN_ID_BYTES).toString('hex');
  const incoming = parseTraceparent(header);
  if (incoming) return { traceId: incoming.traceId, spanId, flags: incoming.flags };
  return { traceId: randomBytes(TRACE_ID_BYTES).toString('hex'), spanId, flags: SAMPLED };
}

/** Formats a trace context as a version-00 `traceparent` header value. */
export function formatTraceparent(ctx: TraceContext): string {
  return `00-${ctx.traceId}-${ctx.spanId}-${ctx.flags}`;
}
