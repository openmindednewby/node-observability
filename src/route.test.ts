import { matchRoute, UNMATCHED_ROUTE } from './route';

describe('matchRoute', () => {
  const resolve = matchRoute(['/api/runs', '/api/users/:id', '/api/users/:id/notes']);

  it('returns the template for a static path', () => {
    expect(resolve('/api/runs')).toBe('/api/runs');
  });

  it('ignores the query string and a trailing slash', () => {
    expect(resolve('/api/runs/?build=3')).toBe('/api/runs');
  });

  it('matches a :param segment without recording its value', () => {
    expect(resolve('/api/users/42/notes')).toBe('/api/users/:id/notes');
  });

  it('caps every unknown path at the literal "unmatched"', () => {
    expect(resolve('/api/users/42/secret')).toBe(UNMATCHED_ROUTE);
    expect(resolve('/wp-login.php')).toBe('unmatched');
  });

  it('does not let a :param match an empty segment', () => {
    expect(resolve('/api/users//notes')).toBe(UNMATCHED_ROUTE);
  });
});
