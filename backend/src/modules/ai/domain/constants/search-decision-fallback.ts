import { SearchDecision } from '../types/search-decision.type';

export const FALLBACK_SEARCH_DECISION: SearchDecision = {
  intent: 'CLARIFY',
  shouldSearch: false,
  requiresClarification: true,
  clarificationQuestion: 'No entendi bien tu pedido. Podes decirme zona, operacion y tipo de propiedad?',
  userFacingMessage: 'No entendi bien tu pedido. Podes decirme zona, operacion y tipo de propiedad?',
  filterPatch: {},
  filtersToUnset: [],
  requestedAction: 'NONE',
};
