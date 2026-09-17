import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ThemeProvider, ThemeToggle } from './theme.js';

describe('ThemeToggle', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    try {
      localStorage.clear();
    } catch {
      /* ignore */
    }
  });

  it('defaults to dark and toggles data-theme on <html>', () => {
    render(
      <ThemeProvider defaultTheme="dark">
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    const btn = screen.getByRole('button', { name: /switch to light theme/i });
    fireEvent.click(btn);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(screen.getByRole('button', { name: /switch to dark theme/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /switch to dark theme/i }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('persists the choice in localStorage', () => {
    render(
      <ThemeProvider defaultTheme="dark" storageKey="test.theme">
        <ThemeToggle />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: /switch to light theme/i }));
    expect(localStorage.getItem('test.theme')).toBe('light');
  });
});
