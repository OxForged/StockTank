import { Badge, EmptyState, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, cn, toast } from '@stocktank/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag } from 'lucide-react';

import { PageTitle } from '../../components/page-title';
import { api } from '../../lib/api';
import { describeApiError } from '../../lib/auth';

export function FeatureFlagsPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'flags'], queryFn: () => api.admin.listFeatureFlags() });
  const toggle = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => api.admin.setFeatureFlag(key, enabled),
    onSuccess: (_d, v) => {
      toast.success(`${v.key} ${v.enabled ? 'enabled' : 'disabled'}`);
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
    onError: (err) => toast.error('Could not change flag', { description: describeApiError(err) }),
  });

  return (
    <>
      <PageTitle
        kicker="System"
        title="Feature flags"
        description="Unfinished features ship switched off (§50). Changes apply immediately and are written to the audit log."
      />
      {q.isError ? (
        <EmptyState icon={<Flag />} title="Could not load flags" description={describeApiError(q.error)} />
      ) : q.isPending ? (
        <Skeleton className="h-72" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Flag</TableHead>
              <TableHead className="hidden md:table-cell">Description</TableHead>
              <TableHead>State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.map((f) => (
              <TableRow key={f.key}>
                <TableCell className="font-mono text-sm">{f.key}</TableCell>
                <TableCell className="hidden text-sm text-muted md:table-cell">{f.description ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={f.enabled}
                      aria-label={`${f.enabled ? 'Disable' : 'Enable'} ${f.key}`}
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate({ key: f.key, enabled: !f.enabled })}
                      className={cn(
                        'relative h-6 w-11 rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60',
                        f.enabled ? 'border-primary bg-primary' : 'border-hairline-strong bg-raised',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn('absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-transform', f.enabled ? 'translate-x-[22px]' : 'translate-x-0.5')}
                      />
                    </button>
                    <Badge variant={f.enabled ? 'primary' : 'neutral'}>{f.enabled ? 'On' : 'Off'}</Badge>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
}
