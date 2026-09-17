import { useEffect } from 'react';

const BASE_TITLE = 'StockTank';

/** Minimal document-title management (no head library needed for a client-rendered shell). */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} — ${BASE_TITLE}` : `${BASE_TITLE} — On-chain stocks & crypto`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
