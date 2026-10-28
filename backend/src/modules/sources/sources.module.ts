import { Module } from '@nestjs/common';
import { AllowedSourceDomainsService } from './application/services/allowed-source-domains.service';
import { HtmlFetchService } from './application/services/html-fetch.service';
import { PropertySourceRegistryService } from './application/services/property-source-registry.service';
import { ArgenpropSourceAdapter } from './infrastructure/adapters/argenprop-source.adapter';
import { MudafySourceAdapter } from './infrastructure/adapters/mudafy-source.adapter';
import { ProperatiSourceAdapter } from './infrastructure/adapters/properati-source.adapter';
import { ZonapropSourceAdapter } from './infrastructure/adapters/zonaprop-source.adapter';

@Module({
  providers: [
    AllowedSourceDomainsService,
    HtmlFetchService,
    ZonapropSourceAdapter,
    ArgenpropSourceAdapter,
    ProperatiSourceAdapter,
    MudafySourceAdapter,
    PropertySourceRegistryService,
  ],
  exports: [
    AllowedSourceDomainsService,
    HtmlFetchService,
    ZonapropSourceAdapter,
    ArgenpropSourceAdapter,
    ProperatiSourceAdapter,
    MudafySourceAdapter,
    PropertySourceRegistryService,
  ],
})
export class SourcesModule {}
