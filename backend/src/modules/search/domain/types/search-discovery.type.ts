export type SearchDiscoveryProvider = 'google-programmable-search' | 'vertex-ai-search';

export type SearchDiscoveryResult = {
  provider: SearchDiscoveryProvider;
  enabled: boolean;
  attemptedQueries: string[];
  candidateUrls: string[];
};
