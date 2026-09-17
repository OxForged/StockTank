import type { LinkLikeProps } from '@stocktank/ui';
import { Link } from 'react-router';

/** Adapter so design-system cards navigate client-side. */
export function RouterLink({ href, ...props }: LinkLikeProps) {
  return <Link to={href} {...props} />;
}
