import { Module } from '@nestjs/common';
import { SearchStateService } from './application/services/search-state.service';
import { SearchStateMergeService } from './application/services/search-state-merge.service';
import { SearchStateRepository } from './infrastructure/repositories/search-state.repository';

@Module({
  providers: [SearchStateService, SearchStateMergeService, SearchStateRepository],
  exports: [SearchStateService, SearchStateMergeService],
})
export class SearchStateModule {}
