import { Module } from '@nestjs/common';
import { AiResponseGeneratorService } from './application/services/ai-response-generator.service';
import { AiSearchDecisionService } from './application/services/ai-search-decision.service';

@Module({
  providers: [AiSearchDecisionService, AiResponseGeneratorService],
  exports: [AiSearchDecisionService, AiResponseGeneratorService],
})
export class AiModule {}
