import { ApiClientError } from '@stocktank/api-client';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockApi } from '../test/mock-api';
import { renderApp } from '../test/render';

vi.mock('@stocktank/api-client', async (importOriginal) => {
  const mod = await importOriginal<object>();
  const { mockApi } = await import('../test/mock-api');
  return { ...mod, createApiClient: () => mockApi };
});

const KIT = {
  advertisingLive: false,
  placements: [
    { key: 'newsletter_primary', name: 'Newsletter primary sponsor', description: 'One slot per issue.', surface: 'newsletter', format: 'newsletter_slot', specs: '600×300 image', pricingModel: 'flat_issue', rateCents: null, currency: 'USD', rateVisibility: 'on_request' },
    { key: 'home_leaderboard', name: 'Homepage leaderboard', description: 'Full width.', surface: 'web', format: 'leaderboard', specs: '970×90', pricingModel: 'cpm', rateCents: 2500, currency: 'USD', rateVisibility: 'public' },
  ],
};

describe('Advertise page', () => {
  beforeEach(() => {
    mockApi.auth.me.mockRejectedValue(new ApiClientError(401, 'UNAUTHENTICATED', 'Not signed in'));
    mockApi.ads.mediaKit.mockResolvedValue(KIT);
    mockApi.ads.serve.mockResolvedValue({ ad: null });
  });

  it('lists formats from the rate card and never invents private rates', async () => {
    renderApp('/advertise');
    expect(await screen.findByRole('heading', { level: 3, name: 'Newsletter primary sponsor' })).toBeInTheDocument();
    expect(screen.getByText('Rates on request')).toBeInTheDocument();
    expect(screen.getByText(/per 1,000 impressions/)).toBeInTheDocument();
    expect(screen.getByText('BOOKING NOW FOR LAUNCH')).toBeInTheDocument();
  });

  it('validates the inquiry and submits selected formats with consent', async () => {
    mockApi.marketing.submitInquiry.mockResolvedValue({ status: 'received' });
    renderApp('/advertise');
    const user = userEvent.setup();
    await screen.findByRole('heading', { level: 3, name: 'Newsletter primary sponsor' });

    await user.click(screen.getByRole('button', { name: 'Send inquiry' }));
    expect(mockApi.marketing.submitInquiry).not.toHaveBeenCalled();
    expect(await screen.findByText(/please confirm so we can reply/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole('checkbox', { name: /interested in this placement/i })[0]!);
    await user.type(screen.getByLabelText(/company/i), 'Acme Custody');
    await user.type(screen.getByLabelText(/your name/i), 'Pat Doe');
    await user.type(screen.getByLabelText(/work email/i), 'pat@acme.example');
    await user.type(screen.getByLabelText(/website/i), 'acme.example');
    await user.selectOptions(screen.getByLabelText(/budget/i), 'from_5k_to_25k');
    await user.type(screen.getByLabelText(/goals and timing/i), 'Sponsor the newsletter next quarter.');
    await user.click(screen.getByRole('checkbox', { name: /stocktank may contact me/i }));
    await user.click(screen.getByRole('button', { name: 'Send inquiry' }));

    expect(await screen.findByText(/we have your inquiry/i)).toBeInTheDocument();
    expect(mockApi.marketing.submitInquiry).toHaveBeenCalledWith(
      expect.objectContaining({
        company: 'Acme Custody',
        email: 'pat@acme.example',
        website: 'https://acme.example',
        placementKeys: ['newsletter_primary'],
        consent: true,
      }),
    );
  });
});

describe('Newsletter', () => {
  beforeEach(() => {
    mockApi.auth.me.mockRejectedValue(new ApiClientError(401, 'UNAUTHENTICATED', 'Not signed in'));
    mockApi.ads.serve.mockResolvedValue({ ad: null });
  });

  it('requires consent before subscribing and explains double opt-in', async () => {
    mockApi.marketing.subscribe.mockResolvedValue({ status: 'check_inbox' });
    renderApp('/newsletter');
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/email address/i), 'reader@example.com');
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/confirm you want to receive/i);
    expect(mockApi.marketing.subscribe).not.toHaveBeenCalled();

    await user.click(screen.getByRole('checkbox', { name: /receive the stocktank newsletter/i }));
    await user.click(screen.getByRole('button', { name: 'Subscribe' }));
    expect(await screen.findByText(/you are not subscribed until you click it/i)).toBeInTheDocument();
    expect(mockApi.marketing.subscribe).toHaveBeenCalledWith(expect.objectContaining({ email: 'reader@example.com', consent: true, source: 'newsletter_page' }));
  });

  it('confirms a subscription from the emailed link exactly once', async () => {
    mockApi.marketing.confirmSubscription.mockResolvedValue({ status: 'confirmed' });
    renderApp(`/newsletter/confirm?token=${'a'.repeat(43)}`);
    expect(await screen.findByText(/you are subscribed/i)).toBeInTheDocument();
    expect(mockApi.marketing.confirmSubscription).toHaveBeenCalledTimes(1);
  });

  it('explains an invalid or expired link', async () => {
    mockApi.marketing.unsubscribe.mockRejectedValue(new ApiClientError(404, 'NOT_FOUND', 'invalid'));
    renderApp(`/newsletter/unsubscribe?token=${'b'.repeat(43)}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid or has expired/i);
  });
});
