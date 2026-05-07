'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { triggerScrapeAction } from '@/app/dev/products/actions';
import type { ChainId } from '@/scrapers/chains';

interface ReScrapeButtonProps {
  /** When omitted, scrapes every chain. */
  chains?: ChainId[];
  label?: string;
}

export function ReScrapeButton({ chains, label = 'Re-scrape ahora' }: ReScrapeButtonProps) {
  const { show } = useToast();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function trigger() {
    setBusy(true);
    startTransition(async () => {
      const res = await triggerScrapeAction(chains);
      setBusy(false);

      if (!res.ok) {
        show({ message: res.error, variant: 'error' });
        return;
      }

      const totals = res.results.reduce(
        (acc, r) => {
          acc.scraped += r.products_scraped;
          acc.matched += r.products_matched;
          acc.upserted += r.upserted;
          acc.errors += r.errors.length;
          return acc;
        },
        { scraped: 0, matched: 0, upserted: 0, errors: 0 },
      );
      const summary = `Scraped ${totals.scraped} · matched ${totals.matched} · upserted ${totals.upserted}${
        totals.errors > 0 ? ` · ${totals.errors} errors` : ''
      }`;
      show({
        message: summary,
        variant: totals.errors > 0 ? 'info' : 'success',
        duration: 6000,
      });
    });
  }

  const disabled = busy || isPending;
  return (
    <Button type="button" variant="outline" size="sm" onClick={trigger} disabled={disabled}>
      {disabled ? 'Scrapeando…' : label}
    </Button>
  );
}
