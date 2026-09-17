import type {
  AdminArticle,
  AdminCompany,
  AdminEpisode,
  AdminLivestream,
  AdminProject,
  AdminShow,
  ArticleInput,
  CompanyInput,
  EpisodeInput,
  LivestreamInput,
  ProjectInput,
  ShowInput,
} from '@stocktank/types';
import { Badge } from '@stocktank/ui';
import { useQuery } from '@tanstack/react-query';

import { EntityEditor, type EntityEditorConfig } from '../components/entity-editor';
import { api } from '../lib/api';
import { formatDate, humanize } from '../lib/format';

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const slugOrUndefined = (v: unknown) => str(v) ?? undefined;

const PROJECT_KINDS = ['crypto_project', 'protocol', 'dao', 'infrastructure', 'rwa', 'ecosystem', 'application', 'traditional_company'];

function useOptions() {
  const shows = useQuery({ queryKey: ['admin', 'cms', 'options', 'shows'], queryFn: () => api.admin.content.listShows({ pageSize: 100 }) });
  const projects = useQuery({ queryKey: ['admin', 'cms', 'options', 'projects'], queryFn: () => api.admin.content.listProjects({ pageSize: 100 }) });
  const companies = useQuery({ queryKey: ['admin', 'cms', 'options', 'companies'], queryFn: () => api.admin.content.listCompanies({ pageSize: 100 }) });
  const chains = useQuery({ queryKey: ['admin', 'cms', 'options', 'chains'], queryFn: () => api.admin.content.listChains() });
  return {
    shows: (shows.data?.items ?? []).map((s) => ({ value: s.id, label: s.title })),
    projects: (projects.data?.items ?? []).map((p) => ({ value: p.id, label: p.name })),
    companies: (companies.data?.items ?? []).map((c) => ({ value: c.id, label: c.name })),
    chains: (chains.data ?? []).map((c) => ({ value: c.slug, label: c.name })),
  };
}

export function ShowsCmsPage() {
  const config: EntityEditorConfig<AdminShow, ShowInput> = {
    kicker: 'Network',
    title: 'Shows',
    noun: 'Show',
    queryKey: 'shows',
    description: 'Shows and their public descriptions. Published shows appear on the homepage lineup and /shows.',
    hasStatus: true,
    list: (q) => api.admin.content.listShows(q),
    save: (input, id) => api.admin.content.saveShow(input, id),
    itemTitle: (s) => s.title,
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, value: (s) => s.title },
      { name: 'slug', label: 'Slug', type: 'text', hint: 'lowercase-with-hyphens', value: (s) => s.slug },
      { name: 'tagline', label: 'Tagline (hero statement)', type: 'text', wide: true, value: (s) => s.tagline },
      { name: 'description', label: 'Description', type: 'textarea', wide: true, value: (s) => s.description },
      { name: 'coverUrl', label: 'Cover image URL', type: 'url', value: (s) => s.coverUrl },
    ],
    toInput: (v) => ({
      title: String(v.title ?? ''),
      slug: slugOrUndefined(v.slug),
      tagline: str(v.tagline),
      description: str(v.description),
      coverUrl: str(v.coverUrl),
      status: (v.status as ShowInput['status']) ?? 'draft',
    }),
    columns: [
      { header: 'Show', cell: (s) => <span className="font-semibold">{s.title}</span> },
      { header: 'Episodes', cell: (s) => <span className="font-mono">{s.episodeCount}</span>, className: 'hidden md:table-cell' },
      { header: 'Updated', cell: (s) => formatDate(s.updatedAt), className: 'hidden lg:table-cell' },
    ],
  };
  return <EntityEditor config={config} />;
}

export function EpisodesCmsPage() {
  const options = useOptions();
  const config: EntityEditorConfig<AdminEpisode, EpisodeInput> = {
    kicker: 'Content',
    title: 'Episodes',
    noun: 'Episode',
    queryKey: 'episodes',
    description: 'Episodes, show notes and the projects and companies discussed. Media upload arrives with the media pipeline (Milestone 3).',
    hasStatus: true,
    list: (q) => api.admin.content.listEpisodes(q),
    save: (input, id) => api.admin.content.saveEpisode(input, id),
    itemTitle: (e) => e.title,
    fields: [
      { name: 'showId', label: 'Show', type: 'select', required: true, options: options.shows, value: (e) => e.showId },
      { name: 'title', label: 'Title', type: 'text', required: true, value: (e) => e.title },
      { name: 'slug', label: 'Slug', type: 'text', value: (e) => e.slug },
      { name: 'number', label: 'Episode number', type: 'number', value: (e) => e.number },
      { name: 'durationSeconds', label: 'Duration (seconds)', type: 'number', value: (e) => e.durationSeconds },
      { name: 'publishedAt', label: 'Publish date', type: 'datetime', hint: 'Defaults to now when published', value: (e) => e.publishedAt },
      { name: 'summary', label: 'Summary', type: 'textarea', wide: true, value: (e) => e.summary },
      { name: 'description', label: 'Show notes', type: 'textarea', wide: true, value: (e) => e.description },
      { name: 'coverUrl', label: 'Cover image URL', type: 'url', value: (e) => e.coverUrl },
      { name: 'projectIds', label: 'Projects discussed', type: 'multiselect', options: options.projects, wide: true, value: (e) => e.projectIds },
      { name: 'companyIds', label: 'Companies discussed', type: 'multiselect', options: options.companies, wide: true, value: (e) => e.companyIds },
    ],
    toInput: (v) => ({
      showId: String(v.showId ?? ''),
      title: String(v.title ?? ''),
      slug: slugOrUndefined(v.slug),
      number: (v.number as number | null) ?? null,
      durationSeconds: (v.durationSeconds as number | null) ?? null,
      publishedAt: str(v.publishedAt),
      summary: str(v.summary),
      description: str(v.description),
      coverUrl: str(v.coverUrl),
      projectIds: (v.projectIds as string[]) ?? [],
      companyIds: (v.companyIds as string[]) ?? [],
      status: (v.status as EpisodeInput['status']) ?? 'draft',
    }),
    columns: [
      {
        header: 'Episode',
        cell: (e) => (
          <>
            <p className="font-semibold">{e.title}</p>
            <p className="text-xs text-muted">{e.show.title}</p>
          </>
        ),
      },
      { header: 'Published', cell: (e) => formatDate(e.publishedAt), className: 'hidden md:table-cell' },
      { header: 'Updated', cell: (e) => formatDate(e.updatedAt), className: 'hidden lg:table-cell' },
    ],
  };
  return <EntityEditor config={config} />;
}

export function ProjectsCmsPage() {
  const options = useOptions();
  const config: EntityEditorConfig<AdminProject, ProjectInput> = {
    kicker: 'Entities',
    title: 'Projects',
    noun: 'Project',
    queryKey: 'projects',
    description: 'On-chain project profiles. Not every project has a token. Profiles are informational; no market data is edited here.',
    hasStatus: true,
    list: (q) => api.admin.content.listProjects(q),
    save: (input, id) => api.admin.content.saveProject(input, id),
    itemTitle: (p) => p.name,
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, value: (p) => p.name },
      { name: 'slug', label: 'Slug', type: 'text', value: (p) => p.slug },
      { name: 'kind', label: 'Kind', type: 'select', required: true, options: PROJECT_KINDS.map((k) => ({ value: k, label: humanize(k) })), value: (p) => p.kind },
      { name: 'symbol', label: 'Token symbol', type: 'text', hint: 'Leave empty if there is no token', value: (p) => p.symbol },
      { name: 'chainSlug', label: 'Chain', type: 'select', options: options.chains, value: (p) => p.chainSlug },
      { name: 'contractAddress', label: 'Contract address', type: 'text', value: (p) => p.contractAddress },
      { name: 'website', label: 'Website', type: 'url', value: (p) => p.website },
      { name: 'twitter', label: 'X handle', type: 'text', value: (p) => p.twitter },
      { name: 'logoUrl', label: 'Logo URL', type: 'url', value: (p) => p.logoUrl },
      { name: 'description', label: 'Description', type: 'textarea', wide: true, value: (p) => p.description },
      { name: 'verified', label: 'Verified by editorial', type: 'checkbox', value: (p) => p.verified },
    ],
    toInput: (v) => ({
      name: String(v.name ?? ''),
      slug: slugOrUndefined(v.slug),
      kind: (v.kind as ProjectInput['kind']) ?? 'crypto_project',
      symbol: str(v.symbol),
      chainSlug: str(v.chainSlug),
      contractAddress: str(v.contractAddress),
      website: str(v.website),
      twitter: str(v.twitter),
      logoUrl: str(v.logoUrl),
      description: str(v.description),
      verified: Boolean(v.verified),
      status: (v.status as ProjectInput['status']) ?? 'draft',
    }),
    columns: [
      {
        header: 'Project',
        cell: (p) => (
          <>
            <p className="font-semibold">
              {p.name} {p.verified ? <Badge variant="primary">verified</Badge> : null}
            </p>
            <p className="text-xs text-muted">{humanize(p.kind)}</p>
          </>
        ),
      },
      { header: 'Chain', cell: (p) => p.chainName ?? '—', className: 'hidden md:table-cell' },
      { header: 'Token', cell: (p) => (p.symbol ? <span className="font-mono">${p.symbol}</span> : 'None'), className: 'hidden md:table-cell' },
    ],
  };
  return <EntityEditor config={config} />;
}

export function CompaniesCmsPage() {
  const config: EntityEditorConfig<AdminCompany, CompanyInput> = {
    kicker: 'Entities',
    title: 'Companies',
    noun: 'Company',
    queryKey: 'companies',
    description: 'Public-company profiles. Coverage is editorial and never a recommendation.',
    hasStatus: true,
    list: (q) => api.admin.content.listCompanies(q),
    save: (input, id) => api.admin.content.saveCompany(input, id),
    itemTitle: (c) => c.name,
    fields: [
      { name: 'name', label: 'Name', type: 'text', required: true, value: (c) => c.name },
      { name: 'slug', label: 'Slug', type: 'text', value: (c) => c.slug },
      { name: 'ticker', label: 'Ticker', type: 'text', value: (c) => c.ticker },
      { name: 'exchange', label: 'Exchange', type: 'text', value: (c) => c.exchange },
      { name: 'sector', label: 'Sector', type: 'text', value: (c) => c.sector },
      { name: 'industry', label: 'Industry', type: 'text', value: (c) => c.industry },
      { name: 'country', label: 'Country', type: 'text', value: (c) => c.country },
      { name: 'website', label: 'Website', type: 'url', value: (c) => c.website },
      { name: 'logoUrl', label: 'Logo URL', type: 'url', value: (c) => c.logoUrl },
      { name: 'description', label: 'Description', type: 'textarea', wide: true, value: (c) => c.description },
    ],
    toInput: (v) => ({
      name: String(v.name ?? ''),
      slug: slugOrUndefined(v.slug),
      ticker: str(v.ticker),
      exchange: str(v.exchange),
      sector: str(v.sector),
      industry: str(v.industry),
      country: str(v.country),
      website: str(v.website),
      logoUrl: str(v.logoUrl),
      description: str(v.description),
      status: (v.status as CompanyInput['status']) ?? 'draft',
    }),
    columns: [
      { header: 'Company', cell: (c) => <span className="font-semibold">{c.name}</span> },
      { header: 'Listing', cell: (c) => (c.ticker ? <span className="font-mono">{c.exchange ? `${c.exchange}:` : ''}{c.ticker}</span> : '—'), className: 'hidden md:table-cell' },
      { header: 'Sector', cell: (c) => c.sector ?? '—', className: 'hidden lg:table-cell' },
    ],
  };
  return <EntityEditor config={config} />;
}

export function ArticlesCmsPage() {
  const config: EntityEditorConfig<AdminArticle, ArticleInput> = {
    kicker: 'Content',
    title: 'Articles',
    noun: 'Article',
    queryKey: 'articles',
    description: 'Explainers and newsroom pieces. When covering outside reporting, write an original summary and link the source; never republish articles.',
    hasStatus: true,
    list: (q) => api.admin.content.listArticles(q),
    save: (input, id) => api.admin.content.saveArticle(input, id),
    itemTitle: (a) => a.title,
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, value: (a) => a.title },
      { name: 'slug', label: 'Slug', type: 'text', value: (a) => a.slug },
      { name: 'author', label: 'Author', type: 'text', value: (a) => a.author },
      { name: 'publishedAt', label: 'Publish date', type: 'datetime', value: (a) => a.publishedAt },
      { name: 'summary', label: 'Summary', type: 'textarea', wide: true, value: (a) => a.summary },
      { name: 'body', label: 'Body', type: 'textarea', wide: true, value: (a) => a.body },
      { name: 'originalUrl', label: 'Original source URL', type: 'url', wide: true, hint: 'Required when summarising outside reporting', value: (a) => a.originalUrl },
    ],
    toInput: (v) => ({
      title: String(v.title ?? ''),
      slug: slugOrUndefined(v.slug),
      author: str(v.author),
      publishedAt: str(v.publishedAt),
      summary: str(v.summary),
      body: str(v.body),
      originalUrl: str(v.originalUrl),
      status: (v.status as ArticleInput['status']) ?? 'draft',
    }),
    columns: [
      { header: 'Article', cell: (a) => <span className="font-semibold">{a.title}</span> },
      { header: 'Author', cell: (a) => a.author ?? '—', className: 'hidden md:table-cell' },
      { header: 'Published', cell: (a) => formatDate(a.publishedAt), className: 'hidden lg:table-cell' },
    ],
  };
  return <EntityEditor config={config} />;
}

export function LivestreamsCmsPage() {
  const options = useOptions();
  const config: EntityEditorConfig<AdminLivestream, LivestreamInput> = {
    kicker: 'Live',
    title: 'Broadcast schedule',
    noun: 'Broadcast',
    queryKey: 'livestreams',
    description: 'The live desk and today’s rundown come from here. Set a broadcast to Live to put it on air; the stream URL connects with the live infrastructure.',
    hasStatus: false,
    list: (q) => api.admin.content.listLivestreams({ page: q.page, pageSize: q.pageSize }),
    save: (input, id) => api.admin.content.saveLivestream(input, id),
    itemTitle: (l) => l.title,
    fields: [
      { name: 'title', label: 'Title', type: 'text', required: true, value: (l) => l.title },
      { name: 'showId', label: 'Show', type: 'select', options: options.shows, value: (l) => l.showId },
      {
        name: 'broadcastStatus',
        label: 'Broadcast status',
        type: 'select',
        required: true,
        options: ['scheduled', 'live', 'ended', 'cancelled'].map((s) => ({ value: s, label: humanize(s) })),
        value: (l) => l.status,
      },
      { name: 'streamUrl', label: 'Stream URL', type: 'url', value: (l) => l.streamUrl },
      { name: 'scheduledStart', label: 'Starts', type: 'datetime', required: true, value: (l) => l.scheduledStart },
      { name: 'scheduledEnd', label: 'Ends', type: 'datetime', value: (l) => l.scheduledEnd },
      { name: 'description', label: 'Description', type: 'textarea', wide: true, value: (l) => l.description },
      { name: 'segments', label: 'Segments (one per line)', type: 'lines', wide: true, value: (l) => l.segments.map((s) => s.title) },
    ],
    toInput: (v) => ({
      title: String(v.title ?? ''),
      showId: str(v.showId),
      status: (v.broadcastStatus as LivestreamInput['status']) ?? 'scheduled',
      streamUrl: str(v.streamUrl),
      scheduledStart: String(v.scheduledStart ?? new Date().toISOString()),
      scheduledEnd: str(v.scheduledEnd),
      description: str(v.description),
      segments: (v.segments as string[]) ?? [],
    }),
    columns: [
      {
        header: 'Broadcast',
        cell: (l) => (
          <>
            <p className="font-semibold">{l.title}</p>
            <p className="text-xs text-muted">{l.show?.title ?? 'No show'}</p>
          </>
        ),
      },
      {
        header: 'Status',
        cell: (l) => (
          <Badge variant={l.status === 'live' ? 'danger' : l.status === 'scheduled' ? 'primary' : 'neutral'}>{humanize(l.status)}</Badge>
        ),
      },
      { header: 'Starts', cell: (l) => formatDate(l.scheduledStart, true), className: 'hidden md:table-cell' },
      { header: 'Segments', cell: (l) => <span className="font-mono">{l.segments.length}</span>, className: 'hidden lg:table-cell' },
    ],
  };
  return <EntityEditor config={config} />;
}
