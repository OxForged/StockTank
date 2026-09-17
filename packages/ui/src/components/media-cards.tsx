import { Headphones, Play, Radio } from 'lucide-react';
import type { ComponentType, HTMLAttributes, ReactNode } from 'react';

import { cn } from '../lib/cn.js';
import { Avatar } from './avatar.js';
import { Badge, LiveBadge } from './badge.js';

/* -------------------------------------------------------------------------- */
/* Shared                                                                      */
/* -------------------------------------------------------------------------- */

export interface LinkLikeProps {
  href: string;
  className?: string;
  children?: ReactNode;
  'aria-label'?: string;
}

/**
 * Cards render a plain <a> by default. Pass a router-aware component (e.g. one wrapping
 * react-router's Link) to keep client-side navigation.
 */
export type LinkComponent = ComponentType<LinkLikeProps>;

function DefaultLink({ href, ...props }: LinkLikeProps) {
  return <a href={href} {...props} />;
}

export interface MediaCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  href?: string;
  linkComponent?: LinkComponent;
  imageUrl?: string | null;
  imageAlt?: string;
  /** Aspect ratio of the image slot. */
  ratio?: 'video' | 'square' | 'portrait' | 'wide';
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  /** Top-left overlay slot (badges). */
  overlay?: ReactNode;
  /** Bottom-right overlay (duration etc). */
  corner?: ReactNode;
  /** Centered icon when hovering the image (e.g. play). */
  hoverIcon?: ReactNode;
  headingLevel?: 'h2' | 'h3' | 'h4';
  size?: 'sm' | 'md' | 'lg';
}

const ratioClass = {
  video: 'aspect-video',
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
  wide: 'aspect-[21/9]',
} as const;

/** Base editorial card: image slot + kicker + title + meta. Everything comes from props. */
export function MediaCard({
  href,
  linkComponent: LinkComp = DefaultLink,
  imageUrl,
  imageAlt = '',
  ratio = 'video',
  kicker,
  title,
  description,
  meta,
  overlay,
  corner,
  hoverIcon,
  headingLevel: Heading = 'h3',
  size = 'md',
  className,
  ...props
}: MediaCardProps) {
  const body = (
    <>
      <div
        className={cn(
          'relative w-full overflow-hidden rounded-md border border-hairline bg-raised',
          ratioClass[ratio],
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={imageAlt}
            loading="lazy"
            className="size-full object-cover transition-transform duration-slow ease-out-expo group-hover:scale-[1.03]"
          />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 bg-grid-fade" />
        )}
        {overlay ? <div className="absolute left-2 top-2 flex flex-wrap gap-1">{overlay}</div> : null}
        {corner ? (
          <div className="absolute bottom-2 right-2 rounded-xs bg-bg/85 px-1.5 py-0.5 font-mono text-[11px] tabular text-fg">
            {corner}
          </div>
        ) : null}
        {hoverIcon ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-base group-hover:opacity-100 group-focus-visible:opacity-100"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-gradient-primary text-on-primary shadow-glow [&_svg]:size-5">
              {hoverIcon}
            </span>
          </div>
        ) : null}
      </div>
      <div className={cn('flex flex-col gap-1', size === 'sm' ? 'mt-2' : 'mt-3')}>
        {kicker ? <p className="kicker text-primary-hi">{kicker}</p> : null}
        <Heading
          className={cn(
            'font-display font-bold leading-tight tracking-tight text-fg',
            size === 'sm' && 'text-sm',
            size === 'md' && 'text-base md:text-lg',
            size === 'lg' && 'text-xl md:text-2xl',
          )}
        >
          {title}
        </Heading>
        {description ? <p className="line-clamp-2 text-sm text-muted">{description}</p> : null}
        {meta ? <p className="mt-1 text-xs text-muted">{meta}</p> : null}
      </div>
    </>
  );

  return (
    <article className={cn('group relative flex flex-col', className)} {...props}>
      {href ? (
        <LinkComp
          href={href}
          className="flex flex-col rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {body}
        </LinkComp>
      ) : (
        body
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* ShowCard                                                                    */
/* -------------------------------------------------------------------------- */

export interface ShowCardProps extends Omit<MediaCardProps, 'title' | 'kicker' | 'meta'> {
  name: string;
  /** e.g. "Weekly · Video" */
  cadence?: string;
  hosts?: readonly string[];
  live?: boolean;
  format?: 'video' | 'audio' | 'live';
}

export function ShowCard({ name, cadence, hosts, live, format, overlay, ...props }: ShowCardProps) {
  return (
    <MediaCard
      title={name}
      kicker={format ? format : 'Show'}
      meta={[cadence, hosts?.length ? `Hosted by ${hosts.join(', ')}` : null].filter(Boolean).join(' · ') || undefined}
      overlay={
        <>
          {live ? <LiveBadge /> : null}
          {overlay}
        </>
      }
      ratio="portrait"
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* EpisodeCard                                                                 */
/* -------------------------------------------------------------------------- */

export interface EpisodeCardProps extends Omit<MediaCardProps, 'title' | 'kicker' | 'meta' | 'corner' | 'hoverIcon'> {
  title: string;
  showName?: string;
  /** Pre-formatted duration, e.g. "42:10". */
  duration?: string;
  /** Pre-formatted date. */
  publishedAt?: string;
  kind?: 'video' | 'audio';
}

export function EpisodeCard({ title, showName, duration, publishedAt, kind = 'video', ...props }: EpisodeCardProps) {
  return (
    <MediaCard
      title={title}
      kicker={showName}
      meta={[publishedAt, kind === 'audio' ? 'Audio' : 'Video'].filter(Boolean).join(' · ')}
      corner={duration}
      hoverIcon={kind === 'audio' ? <Headphones aria-hidden="true" /> : <Play aria-hidden="true" />}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* ProjectCard                                                                 */
/* -------------------------------------------------------------------------- */

export interface ProjectCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  name: string;
  symbol?: string;
  chain?: string;
  category?: string;
  description?: string;
  logoUrl?: string | null;
  href?: string;
  linkComponent?: LinkComponent;
  /** Optional slot for a caller-supplied stat (pre-formatted). */
  stat?: ReactNode;
}

export function ProjectCard({
  name,
  symbol,
  chain,
  category,
  description,
  logoUrl,
  href,
  linkComponent: LinkComp = DefaultLink,
  stat,
  className,
  ...props
}: ProjectCardProps) {
  const body = (
    <>
      <div className="flex items-center gap-3">
        <Avatar name={name} src={logoUrl} size="lg" className="rounded-md" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-bold leading-tight text-fg">{name}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-mono text-xs text-muted">
            {symbol ? <span className="text-primary-hi">{symbol}</span> : null}
            {chain ? <span>· {chain}</span> : null}
          </p>
        </div>
        {stat ? <div className="shrink-0 text-right font-mono text-sm tabular text-fg">{stat}</div> : null}
      </div>
      {description ? <p className="mt-3 line-clamp-2 text-sm text-muted">{description}</p> : null}
      {category ? (
        <div className="mt-3">
          <Badge variant="neutral">{category}</Badge>
        </div>
      ) : null}
    </>
  );
  return (
    <article
      className={cn(
        'group rounded-lg border border-hairline bg-surface p-4 shadow-card transition-[border-color,transform] duration-base ease-out-expo hover:-translate-y-0.5 hover:border-hairline-strong',
        className,
      )}
      {...props}
    >
      {href ? (
        <LinkComp href={href} className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          {body}
        </LinkComp>
      ) : (
        body
      )}
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* CompanyCard                                                                 */
/* -------------------------------------------------------------------------- */

export interface CompanyCardProps extends Omit<ProjectCardProps, 'symbol' | 'chain'> {
  ticker?: string;
  exchange?: string;
  sector?: string;
}

export function CompanyCard({ ticker, exchange, sector, category, ...props }: CompanyCardProps) {
  return <ProjectCard symbol={ticker} chain={exchange} category={sector ?? category} {...props} />;
}

/* -------------------------------------------------------------------------- */
/* CreatorCard                                                                 */
/* -------------------------------------------------------------------------- */

export interface CreatorCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  name: string;
  handle?: string;
  role?: string;
  bio?: string;
  avatarUrl?: string | null;
  href?: string;
  linkComponent?: LinkComponent;
  live?: boolean;
}

export function CreatorCard({
  name,
  handle,
  role,
  bio,
  avatarUrl,
  href,
  linkComponent: LinkComp = DefaultLink,
  live,
  className,
  ...props
}: CreatorCardProps) {
  const body = (
    <>
      <div className="relative">
        <Avatar name={name} src={avatarUrl} size="xl" />
        {live ? (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2">
            <LiveBadge />
          </span>
        ) : null}
      </div>
      <h3 className="mt-4 font-display text-base font-bold leading-tight text-fg">{name}</h3>
      {handle ? <p className="font-mono text-xs text-primary-hi">@{handle.replace(/^@/, '')}</p> : null}
      {role ? <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted">{role}</p> : null}
      {bio ? <p className="mt-2 line-clamp-3 text-sm text-muted">{bio}</p> : null}
    </>
  );
  return (
    <article
      className={cn(
        'group flex flex-col items-center rounded-lg border border-hairline bg-surface p-5 text-center shadow-card transition-[border-color,transform] duration-base ease-out-expo hover:-translate-y-0.5 hover:border-hairline-strong',
        className,
      )}
      {...props}
    >
      {href ? (
        <LinkComp href={href} className="flex flex-col items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
          {body}
        </LinkComp>
      ) : (
        body
      )}
    </article>
  );
}

/** Small on-air chip for masthead/live rails. */
export function OnAirChip({ station, className }: { station?: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-xs text-muted', className)}>
      <Radio className="size-3.5 text-live" aria-hidden="true" />
      {station ?? 'Off air'}
    </span>
  );
}
