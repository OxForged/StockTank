import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LogoMark, Wordmark } from './logo.js';

describe('Wordmark', () => {
  it('renders an accessible brand label', () => {
    render(<Wordmark />);
    expect(screen.getByRole('img', { name: 'StockTank' })).toBeInTheDocument();
  });

  it('includes the tagline in the label when shown', () => {
    render(<Wordmark tagline />);
    expect(screen.getByRole('img', { name: 'StockTank — On-chain stocks & crypto' })).toBeInTheDocument();
    expect(screen.getByText(/on-chain stocks & crypto/i)).toBeInTheDocument();
  });
});

describe('LogoMark', () => {
  it('is decorative by default and labelled when given a title', () => {
    const { container, rerender } = render(<LogoMark />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    rerender(<LogoMark title="StockTank" />);
    expect(screen.getByRole('img', { name: 'StockTank' })).toBeInTheDocument();
  });
});
