export const CacheControlHeader: string = `public, max-age=${
  process.env.CACHE_MAX_AGE || 300
}, s-maxage=${process.env.CACHE_MAX_AGE || 300}, stale-while-revalidate=${
  process.env.CACHE_STALE_WHILE_REVALIDATE || 60
}, stale-if-error=${process.env.CACHE_STALE_WHILE_REVALIDATE || 60}`;
