import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockApi } from '../../test/mock-api';
import { AdSlot } from './ad-slot';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

const AD = {
  placement: 'home_native_feed',
  kind: 'native',
  advertiserName: 'Acme Custody',
  headline: 'Custody for tokenized funds',
  body: 'Learn how settlement works.',
  imageUrl: null,
  altText: null,
  ctaLabel: 'Learn more',
  clickUrl: '/api/v1/ads/click/signed-token',
  disclosureLabel: 'Sponsored',
  impressionToken: 'signed-token',
  isHouse: false,
} as const;

let observerCallback: IntersectionObserverCallback | undefined;

class FakeObserver {
  constructor(cb: IntersectionObserverCallback) {
    observerCallback = cb;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
  takeRecords() {
    return [];
  }
  root = null;
  rootMargin = '';
  thresholds = [];
}

function renderSlot() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <AdSlot placement="home_native_feed" variant="card" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function intersect(ratio: number) {
  observerCallback?.([{ intersectionRatio: ratio } as IntersectionObserverEntry], {} as IntersectionObserver);
}

describe('AdSlot', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    mockApi.ads.recordImpression.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    observerCallback = undefined;
  });

  it('renders nothing when no ad is eligible', async () => {
    mockApi.ads.serve.mockResolvedValue({ ad: null });
    const { container } = renderSlot();
    await vi.waitFor(() => expect(mockApi.ads.serve).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('discloses the ad and links through tracking with rel="sponsored"', async () => {
    mockApi.ads.serve.mockResolvedValue({ ad: AD });
    renderSlot();
    expect(await screen.findByText('Custody for tokenized funds')).toBeInTheDocument();
    expect(screen.getByText('Sponsored')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Sponsored: Acme Custody' })).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/api/v1/ads/click/signed-token');
    expect(link.getAttribute('rel')).toContain('sponsored');
  });

  it('records one impression only after 50% visibility for a full second', async () => {
    mockApi.ads.serve.mockResolvedValue({ ad: AD });
    renderSlot();
    await screen.findByText('Custody for tokenized funds');
    vi.useFakeTimers();

    act(() => intersect(0.6));
    act(() => vi.advanceTimersByTime(500));
    act(() => intersect(0.2));
    act(() => vi.advanceTimersByTime(1000));
    expect(mockApi.ads.recordImpression).not.toHaveBeenCalled();

    act(() => intersect(0.8));
    act(() => vi.advanceTimersByTime(1000));
    expect(mockApi.ads.recordImpression).toHaveBeenCalledTimes(1);
    expect(mockApi.ads.recordImpression).toHaveBeenCalledWith('signed-token');
  });
});
