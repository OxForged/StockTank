import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './button.js';

describe('Button', () => {
  it('renders a button with the primary variant by default', () => {
    render(<Button>Sign in</Button>);
    const btn = screen.getByRole('button', { name: 'Sign in' });
    expect(btn).toHaveAttribute('type', 'button');
    expect(btn.className).toContain('bg-gradient-primary');
  });

  it('applies variant and size classes', () => {
    render(
      <Button variant="danger" size="sm">
        Delete
      </Button>,
    );
    const btn = screen.getByRole('button', { name: 'Delete' });
    expect(btn.className).toContain('text-danger');
    expect(btn.className).toContain('h-8');
  });

  it('renders the child element when asChild is set', () => {
    render(
      <Button asChild variant="outline">
        <a href="/signup">Create account</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Create account' });
    expect(link).toHaveAttribute('href', '/signup');
    expect(link.className).toContain('border-hairline-strong');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('disables the control and marks it busy while loading', () => {
    render(<Button loading>Saving</Button>);
    const btn = screen.getByRole('button', { name: 'Saving' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });
});
