import { Button, EmptyState, type EmptyStateProps } from '@stocktank/ui';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export interface MilestoneEmptyProps extends Omit<EmptyStateProps, 'kicker' | 'action'> {
  /** README §53 milestone that delivers this content. Omit for "a later release". */
  milestone?: number;
  milestoneLabel?: string;
  /** Show the "Create account" call to action. */
  cta?: boolean;
  extraAction?: ReactNode;
}

/** Empty state that names the milestone honestly instead of faking content. */
export function MilestoneEmpty({ milestone, milestoneLabel, cta, extraAction, ...props }: MilestoneEmptyProps) {
  const kicker = milestone ? `Scheduled for Milestone ${milestone}${milestoneLabel ? ` · ${milestoneLabel}` : ''}` : 'Coming in a later release';
  return (
    <EmptyState
      kicker={kicker}
      action={
        cta || extraAction ? (
          <>
            {cta ? (
              <Button asChild size="sm">
                <Link to="/signup">Create a free account</Link>
              </Button>
            ) : null}
            {extraAction}
          </>
        ) : undefined
      }
      {...props}
    />
  );
}
