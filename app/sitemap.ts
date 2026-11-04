import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://fincity.dev/', changeFrequency: 'weekly', priority: 1 },
    { url: 'https://fincity.dev/about/', changeFrequency: 'monthly', priority: 0.8 },
  ];
}
