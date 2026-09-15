'use client';

import { SearchIcon } from '@/components/icons/SearchIcon';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search...' }: SearchInputProps) {
  return (
    <div className="relative w-full">
      <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-[18px] text-[#111]/50" />
      <input
        suppressHydrationWarning
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search podcasts"
        className="w-full h-12 rounded-[10px] border border-border-warm bg-transparent pl-12 pr-4 font-inter text-base text-[#111] placeholder:text-[#111]/50 outline-none focus:border-[#111]/30 transition-colors"
      />
    </div>
  );
}
