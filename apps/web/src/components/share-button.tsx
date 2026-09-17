import { Button, toast } from '@stocktank/ui';
import { Share2 } from 'lucide-react';

import { track, type TrackedEntity } from '../lib/analytics';

/** Native share sheet where available, otherwise copies the link. Records a share for analytics either way. */
export function ShareButton({ title, url, entity }: { title: string; url: string; entity: TrackedEntity }) {
  async function share() {
    const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ title, url });
        track({ type: 'share', channel: 'native', ...entity });
      } catch {
        // The viewer closed the share sheet: nothing was shared.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      track({ type: 'share', channel: 'copy_link', ...entity });
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link', { description: url });
    }
  }

  return (
    <Button variant="ghost" className="self-start" onClick={() => void share()}>
      <Share2 className="size-4" aria-hidden="true" />
      Share
    </Button>
  );
}
