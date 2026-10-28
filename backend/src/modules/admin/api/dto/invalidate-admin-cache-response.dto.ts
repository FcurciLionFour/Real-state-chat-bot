export type InvalidateAdminCacheResponseDto = {
  prefixes: string[];
  redisAvailable: boolean;
  matchedKeys: number;
  deletedKeys: number;
};
