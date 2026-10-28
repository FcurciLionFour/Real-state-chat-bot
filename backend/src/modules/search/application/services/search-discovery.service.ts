import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SearchDiscoveryProvider, SearchDiscoveryResult } from '../../domain/types/search-discovery.type';
import { GoogleDiscoveryService } from './google-discovery.service';
import { VertexDiscoveryService } from './vertex-discovery.service';

type SearchDiscoveryStatus = {
  provider: SearchDiscoveryProvider;
  configured: boolean;
  credentialGaps: string[];
};

@Injectable()
export class SearchDiscoveryService {
  constructor(
    private readonly configService: ConfigService,
    private readonly googleDiscoveryService: GoogleDiscoveryService,
    private readonly vertexDiscoveryService: VertexDiscoveryService,
  ) {}

  async discover(queries: string[]): Promise<SearchDiscoveryResult> {
    return this.resolveActiveService().discover(queries);
  }

  getStatus(): SearchDiscoveryStatus {
    const activeService = this.resolveActiveService();

    return {
      provider: activeService.getProvider(),
      configured: activeService.isConfigured(),
      credentialGaps: activeService.getCredentialGaps(),
    };
  }

  private resolveActiveService() {
    return this.getConfiguredProvider() === 'vertex-ai-search'
      ? this.vertexDiscoveryService
      : this.googleDiscoveryService;
  }

  private getConfiguredProvider(): SearchDiscoveryProvider {
    const provider = this.configService.get<SearchDiscoveryProvider>(
      'search.discoveryProvider',
      'google-programmable-search',
    );

    return provider === 'vertex-ai-search' ? 'vertex-ai-search' : 'google-programmable-search';
  }
}
