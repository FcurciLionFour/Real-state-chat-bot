"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchStateMergeService = void 0;
const common_1 = require("@nestjs/common");
const default_search_filters_1 = require("../../domain/constants/default-search-filters");
let SearchStateMergeService = class SearchStateMergeService {
    applySearchDecision(currentState, decision) {
        const nextState = structuredClone(currentState);
        for (const key of decision.filtersToUnset) {
            this.unsetField(nextState, key);
        }
        for (const [key, value] of Object.entries(decision.filterPatch)) {
            this.setField(nextState, key, value);
        }
        const didSearch = decision.requestedAction === 'SEARCH' &&
            decision.shouldSearch &&
            !decision.requiresClarification;
        return {
            searchState: nextState,
            assistantMessage: decision.userFacingMessage.trim(),
            requiresClarification: decision.requiresClarification,
            clarificationQuestion: decision.clarificationQuestion,
            didSearch,
        };
    }
    unsetField(searchState, key) {
        searchState[key] = structuredClone(default_search_filters_1.DEFAULT_SEARCH_FILTERS[key]);
    }
    setField(searchState, key, value) {
        searchState[key] = structuredClone(value);
    }
};
exports.SearchStateMergeService = SearchStateMergeService;
exports.SearchStateMergeService = SearchStateMergeService = __decorate([
    (0, common_1.Injectable)()
], SearchStateMergeService);
