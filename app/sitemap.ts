import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://fincity.dev/', changeFrequency: 'weekly', priority: 1 },
    { url: 'https://fincity.dev/about/', changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://fincity.dev/privacy/', changeFrequency: 'yearly', priority: 0.3 },
    { url: 'https://fincity.dev/terms/', changeFrequency: 'yearly', priority: 0.3 },
  ];
}
