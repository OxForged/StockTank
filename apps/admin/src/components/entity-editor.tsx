import type { AdminList, PublishStatus } from '@stocktank/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
  toast,
} from '@stocktank/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus, Search } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { describeApiError, useMe } from '../lib/auth';
import { REVIEW_STATUS_VARIANT, humanize } from '../lib/format';
import { PageTitle } from './page-title';

const SELECT = 'h-10 w-full rounded-md border border-hairline-strong bg-bg px-3 text-sm text-fg focus:border-primary focus:outline-none';
const WRITER_STATUSES: PublishStatus[] = ['draft', 'review'];
const ALL_STATUSES: PublishStatus[] = ['draft', 'review', 'approved', 'rejected', 'published', 'archived'];

export type FieldType = 'text' | 'textarea' | 'url' | 'number' | 'select' | 'datetime' | 'checkbox' | 'multiselect' | 'lines';

export interface FieldConfig<T> {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  hint?: string;
  /** Options for select/multiselect. */
  options?: Array<{ value: string; label: string }>;
  /** Reads the current value from an item when editing. */
  value?: (item: T) => string | number | boolean | string[] | null | undefined;
  wide?: boolean;
}

export interface EntityEditorConfig<T extends { id: string }, I> {
  kicker: string;
  title: string;
  description: string;
  noun: string;
  queryKey: string;
  /** Items with a publish status get the editorial status field and filter. */
  hasStatus: boolean;
  list: (q: { page: number; pageSize: number; status?: PublishStatus; q?: string }) => Promise<AdminList<T>>;
  save: (input: I, id?: string) => Promise<T>;
  fields: Array<FieldConfig<T>>;
  /** Converts the raw form values into the API input. */
  toInput: (values: Record<string, unknown>) => I;
  columns: Array<{ header: string; cell: (item: T) => ReactNode; className?: string }>;
  itemTitle: (item: T) => string;
}

function readForm<T>(form: HTMLFormElement, fields: Array<FieldConfig<T>>): Record<string, unknown> {
  const d = new FormData(form);
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === 'checkbox') out[f.name] = d.get(f.name) === 'on';
    else if (f.type === 'multiselect') out[f.name] = d.getAll(f.name).map(String);
    else if (f.type === 'number') {
      const v = String(d.get(f.name) ?? '').trim();
      out[f.name] = v === '' ? null : Number(v);
    } else if (f.type === 'lines') {
      out[f.name] = String(d.get(f.name) ?? '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (f.type === 'datetime') {
      const v = String(d.get(f.name) ?? '').trim();
      out[f.name] = v ? new Date(v).toISOString() : null;
    } else {
      const v = String(d.get(f.name) ?? '').trim();
      out[f.name] = v === '' ? null : v;
    }
  }
  const status = d.get('status');
  if (status) out.status = String(status);
  return out;
}

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function Field<T>({ field, item }: { field: FieldConfig<T>; item: T | null }) {
  const current = item && field.value ? field.value(item) : undefined;
  const id = `f-${field.name}`;
  const common = { id, name: field.name, required: field.required };
  let control: ReactNode;
  switch (field.type) {
    case 'textarea':
      control = <Textarea {...common} rows={field.wide ? 6 : 3} defaultValue={(current as string | null) ?? ''} />;
      break;
    case 'number':
      control = <Input {...common} type="number" min={0} defaultValue={current === null || current === undefined ? '' : String(current)} />;
      break;
    case 'url':
      control = <Input {...common} type="url" placeholder="https://" defaultValue={(current as string | null) ?? ''} />;
      break;
    case 'datetime':
      control = <Input {...common} type="datetime-local" defaultValue={toLocalInput(current as string | null)} />;
      break;
    case 'select':
      control = (
        <select {...common} defaultValue={(current as string | null) ?? ''} className={SELECT}>
          {!field.required ? <option value="">None</option> : null}
          {(field.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" name={field.name} defaultChecked={Boolean(current)} className="size-4 accent-[var(--st-primary)]" />
          {field.label}
        </label>
      );
    case 'multiselect': {
      const selected = new Set((current as string[] | undefined) ?? []);
      control = (
        <div className="grid max-h-44 gap-1 overflow-y-auto rounded-md border border-hairline p-2 sm:grid-cols-2">
          {(field.options ?? []).length === 0 ? <span className="text-xs text-muted">No options yet</span> : null}
          {(field.options ?? []).map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name={field.name} value={o.value} defaultChecked={selected.has(o.value)} className="size-4 accent-[var(--st-primary)]" />
              {o.label}
            </label>
          ))}
        </div>
      );
      break;
    }
    case 'lines':
      control = <Textarea {...common} rows={5} defaultValue={((current as string[] | undefined) ?? []).join('\n')} />;
      break;
    default:
      control = <Input {...common} defaultValue={(current as string | null) ?? ''} />;
  }
  return (
    <FormField label={field.label} htmlFor={id} required={field.required} hint={field.hint} className={field.wide ? 'sm:col-span-2' : undefined}>
      {() => control}
    </FormField>
  );
}

/** Generic editorial list + editor used by the CMS pages. */
export function EntityEditor<T extends { id: string; status?: string; isDemo?: boolean }, I>({ config }: { config: EntityEditorConfig<T, I> }) {
  const { user } = useMe();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') as PublishStatus | null) ?? undefined;
  const search = params.get('q') ?? '';
  const [editing, setEditing] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);
  const canPublish = Boolean(user?.permissions.includes('content.publish'));
  const statuses = canPublish ? ALL_STATUSES : WRITER_STATUSES;

  const q = useQuery({
    queryKey: ['admin', 'cms', config.queryKey, status ?? 'all', search],
    queryFn: () => config.list({ page: 1, pageSize: 100, status, q: search || undefined }),
    placeholderData: keepPreviousData,
  });

  const save = useMutation({
    mutationFn: ({ input, id }: { input: I; id?: string }) => config.save(input, id),
    onSuccess: (item) => {
      toast.success(`${config.noun} saved`, { description: config.itemTitle(item) });
      void qc.invalidateQueries({ queryKey: ['admin', 'cms'] });
      setEditing(null);
      setCreating(false);
    },
    onError: (err) => toast.error(`Could not save ${config.noun.toLowerCase()}`, { description: describeApiError(err) }),
  });

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = readForm(e.currentTarget, config.fields);
    save.mutate({ input: config.toInput(values), id: editing?.id });
  }

  function setFilter(key: 'status' | 'q', value: string | undefined) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });
  }

  const open = creating || Boolean(editing);
  const item = editing;
  const itemStatus = config.hasStatus ? (item?.status as PublishStatus | undefined) : undefined;
  const statusLocked = Boolean(itemStatus && !statuses.includes(itemStatus));

  return (
    <>
      <PageTitle
        kicker={config.kicker}
        title={config.title}
        description={config.description}
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus aria-hidden="true" />
            New {config.noun.toLowerCase()}
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <form
          role="search"
          className="relative"
          onSubmit={(e) => {
            e.preventDefault();
            setFilter('q', String(new FormData(e.currentTarget).get('q') ?? '').trim() || undefined);
          }}
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <label htmlFor={`${config.queryKey}-q`} className="sr-only">
            Search {config.title.toLowerCase()}
          </label>
          <Input id={`${config.queryKey}-q`} name="q" defaultValue={search} placeholder="Search" className="h-9 w-56 pl-8" />
        </form>
        {config.hasStatus ? (
          <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1">
            <Button size="sm" variant={!status ? 'secondary' : 'ghost'} onClick={() => setFilter('status', undefined)}>
              All
            </Button>
            {ALL_STATUSES.map((s) => (
              <Button key={s} size="sm" variant={status === s ? 'secondary' : 'ghost'} onClick={() => setFilter('status', s)}>
                {humanize(s)}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {q.isError ? (
        <EmptyState icon={<FileText />} title={`Could not load ${config.title.toLowerCase()}`} description={describeApiError(q.error)} />
      ) : q.isPending ? (
        <Skeleton className="h-72" />
      ) : q.data.items.length === 0 ? (
        <EmptyState icon={<FileText />} title={`No ${config.title.toLowerCase()}`} description={`Create the first ${config.noun.toLowerCase()}.`} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {config.columns.map((c) => (
                <TableHead key={c.header} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
              {config.hasStatus ? <TableHead>Status</TableHead> : null}
              <TableHead className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.data.items.map((row) => (
              <TableRow key={row.id}>
                {config.columns.map((c) => (
                  <TableCell key={c.header} className={c.className}>
                    {c.cell(row)}
                  </TableCell>
                ))}
                {config.hasStatus ? (
                  <TableCell>
                    <span className="flex flex-wrap gap-1">
                      <Badge variant={REVIEW_STATUS_VARIANT[row.status ?? 'draft']}>{humanize(row.status ?? 'draft')}</Badge>
                      {row.isDemo ? <Badge variant="warning">demo</Badge> : null}
                    </span>
                  </TableCell>
                ) : null}
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(row)}>
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setCreating(false);
          }
        }}
      >
        <DialogContent size="lg" className="max-h-[90dvh] overflow-y-auto">
          {open ? (
            <form onSubmit={onSubmit} key={item?.id ?? 'new'} className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>{item ? `Edit ${config.noun.toLowerCase()}` : `New ${config.noun.toLowerCase()}`}</DialogTitle>
                <DialogDescription>
                  {item ? config.itemTitle(item) : 'Leave the slug empty to generate it from the title.'}
                  {config.hasStatus && !canPublish ? ' You can save drafts and submit for review; an editor publishes.' : ''}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                {config.fields.map((f) => (
                  <Field key={f.name} field={f} item={item} />
                ))}
                {config.hasStatus ? (
                  <FormField label="Status" htmlFor="f-status" hint={statusLocked ? 'Only an editor can change this status.' : undefined}>
                    {({ id }) => (
                      <select id={id} name="status" defaultValue={itemStatus ?? 'draft'} disabled={statusLocked} className={SELECT}>
                        {(statusLocked && itemStatus ? [itemStatus] : statuses).map((s) => (
                          <option key={s} value={s}>
                            {humanize(s)}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>
                ) : null}
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditing(null);
                    setCreating(false);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={save.isPending} disabled={statusLocked}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
