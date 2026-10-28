import { formatTraceparent, parseTraceparent, startTrace } from './traceparent';

const TRACE = '4bf92f3577b34da6a3ce929d0e0e4736';
const PARENT = '00f067aa0ba902b7';

describe('parseTraceparent', () => {
  it('reads a valid W3C header', () => {
    expect(parseTraceparent(`00-${TRACE}-${PARENT}-01`)).toEqual({ traceId: TRACE, parentSpanId: PARENT, flags: '01' });
  });

  it.each([
    ['missing', undefined],
    ['garbage', 'not-a-trace'],
    ['all-zero trace id', `00-${'0'.repeat(32)}-${PARENT}-01`],
    ['all-zero span id', `00-${TRACE}-${'0'.repeat(16)}-01`],
    ['forbidden version ff', `ff-${TRACE}-${PARENT}-01`],
    ['upper-case hex', `00-${TRACE.toUpperCase()}-${PARENT}-01`],
  ])('rejects %s', (_name, header) => {
    expect(parseTraceparent(header)).toBeNull();
  });
});

describe('startTrace', () => {
  it('continues the incoming trace with a new span id', () => {
    const ctx = startTrace(`00-${TRACE}-${PARENT}-01`);
    expect(ctx.traceId).toBe(TRACE);
    expect(ctx.spanId).toMatch(/^[0-9a-f]{16}$/);
    expect(ctx.spanId).not.toBe(PARENT);
    expect(ctx.flags).toBe('01');
  });

  it('starts a new sampled trace when the header is absent or invalid', () => {
    const ctx = startTrace('junk');
    expect(ctx.traceId).toMatch(/^[0-9a-f]{32}$/);
    expect(ctx.flags).toBe('01');
  });
});

describe('formatTraceparent', () => {
  it('writes version 00 with this span as the parent', () => {
    expect(formatTraceparent({ traceId: TRACE, spanId: PARENT, flags: '00' })).toBe(`00-${TRACE}-${PARENT}-00`);
  });
});
