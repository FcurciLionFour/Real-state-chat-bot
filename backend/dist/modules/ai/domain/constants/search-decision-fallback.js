"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FALLBACK_SEARCH_DECISION = void 0;
exports.FALLBACK_SEARCH_DECISION = {
    intent: 'CLARIFY',
    shouldSearch: false,
    requiresClarification: true,
    clarificationQuestion: 'No entendi bien tu pedido. Podes decirme zona, operacion y tipo de propiedad?',
    userFacingMessage: 'No entendi bien tu pedido. Podes decirme zona, operacion y tipo de propiedad?',
    filterPatch: {},
    filtersToUnset: [],
    requestedAction: 'NONE',
};
