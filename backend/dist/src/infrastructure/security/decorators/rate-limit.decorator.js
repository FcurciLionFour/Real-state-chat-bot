"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimit = exports.RATE_LIMIT_OPTIONS = void 0;
const common_1 = require("@nestjs/common");
exports.RATE_LIMIT_OPTIONS = 'rate_limit_options';
const RateLimit = (options) => (0, common_1.SetMetadata)(exports.RATE_LIMIT_OPTIONS, options);
exports.RateLimit = RateLimit;
