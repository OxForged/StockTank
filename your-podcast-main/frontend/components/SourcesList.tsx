'use client';

import { useState } from 'react';
import type { Source } from '@/types/audio';
import { ChevronDownIcon } from '@/components/icons/ChevronDownIcon';
import { ExternalLinkIcon } from '@/components/icons/ExternalLinkIcon';

interface SourcesListProps {
  readonly sources: readonly Source[];
}

export function SourcesList({ sources }: SourcesListProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div className="border-t border-border-warm pt-4">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left"
      >
        <span className="font-serif font-bold text-sm text-[#111]">
          Sources ({sources.length})
        </span>
        <ChevronDownIcon
          className={`size-5 text-[#666] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <div className="collapsible-grid" data-open={isOpen}>
        <div>
          <div className="mt-3 flex flex-col gap-2">
            {sources.map((source) => (
              <a
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#111]/[0.03] hover:bg-[#111]/[0.06] active:bg-[#111]/[0.1] transition-colors"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-inter text-sm text-[#111] truncate">{source.title}</span>
                  <span className="font-inter text-xs text-[#666]">{source.source}</span>
                </div>
                <ExternalLinkIcon className="size-4 shrink-0 ml-3 text-[#666]" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
