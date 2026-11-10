import { describe, expect, it } from 'vitest';
import { isNavActive } from '../nav';

describe('isNavActive', () => {
  it('highlights the "/" Dashboard item on both dashboard routes', () => {
    expect(isNavActive('/', '/')).toBe(true);
    expect(isNavActive('/dashboard', '/')).toBe(true);
  });

  it('does not highlight "/" on other pages', () => {
    expect(isNavActive('/inventory', '/')).toBe(false);
    expect(isNavActive('/govi', '/')).toBe(false);
  });

  it('prefix-matches non-root items', () => {
    expect(isNavActive('/inventory', '/inventory')).toBe(true);
    expect(isNavActive('/govi/regulations/eu/5', '/govi')).toBe(true);
    expect(isNavActive('/dashboard', '/inventory')).toBe(false);
  });
});
