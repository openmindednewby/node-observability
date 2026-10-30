import { createBoundedLabel, OTHER_LABEL_VALUE } from './boundedLabel';

describe('createBoundedLabel', () => {
  it('with fewer distinct values than the limit, returns each value unchanged', () => {
    const bound = createBoundedLabel(3);
    bound('a');
    bound('b');

    const value = bound('c');

    expect(value).toBe('c');
  });

  it('with a new value past the limit, returns other', () => {
    const bound = createBoundedLabel(2);
    bound('a');
    bound('b');

    const value = bound('c');

    expect(value).toBe(OTHER_LABEL_VALUE);
  });

  it('with an already seen value past the limit, returns the value', () => {
    const bound = createBoundedLabel(2);
    bound('a');
    bound('b');
    bound('c');

    const value = bound('a');

    expect(value).toBe('a');
  });

  it('with no limit given, keeps the first 100 distinct values', () => {
    const bound = createBoundedLabel();
    Array.from({ length: 100 }, (_, i) => bound(`t${i}`));

    const values = [bound('t99'), bound('t100')];

    expect(values).toEqual(['t99', OTHER_LABEL_VALUE]);
  });
});
