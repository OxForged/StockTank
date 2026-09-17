import { Button, EmptyState } from '@stocktank/ui';
import { CircleAlert } from 'lucide-react';
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <EmptyState
      variant="surface"
      size="lg"
      icon={<CircleAlert />}
      kicker="404"
      title="No such page in the control room"
      description="Check the address, or pick a section from the navigation."
      action={
        <Button asChild variant="secondary" size="sm">
          <Link to="/">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
