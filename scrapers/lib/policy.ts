/**
 * Scraper behavior policy. All chain-agnostic constants live here so
 * compliance review (`docs/scraping/compliance.md`) and the runtime stay
 * in lock-step.
 *
 * Numbers tuned for an academic project — gentle on the supers, slow but
 * defensible. Tighten only with explicit reason + a comment.
 */

export const POLICY = {
  /** Identifies our traffic in supermarket logs and gives them a way to contact. */
  userAgent:
    'Mozilla/5.0 (compatible; FitListBot/0.1; +https://github.com/juanbag25/proyecto_progra_web; academic-project)',

  /** Floor between consecutive requests to the SAME chain. */
  rateLimitMs: 2000,

  /** Per-attempt fetch timeout. VTEX usually responds in <2s; 30s is a generous ceiling. */
  timeoutMs: 30_000,

  /** Backoff schedule on retryable errors (5xx, 429, network). After the last entry, give up. */
  retryBackoffsMs: [5_000, 15_000, 60_000],

  /**
   * VTEX returns max 50 items per page (`_to - _from + 1` is capped server-side).
   * For the academic demo we only fetch the first page per query — covers the
   * top results without burning the rate-limit budget. P5.C can crank this
   * up once the cron is running.
   */
  maxPagesPerQuery: 1,

  /** Hard ceiling on consecutive failures before we abort the job. */
  abortAfterConsecutiveFailures: 4,
} as const;
