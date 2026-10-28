"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeEmail = normalizeEmail;
exports.trimString = trimString;
exports.trimStringOrUndefined = trimStringOrUndefined;
function normalizeEmail(value) {
    if (typeof value !== 'string') {
        return value;
    }
    return value.trim().toLowerCase();
}
function trimString(value) {
    if (typeof value !== 'string') {
        return value;
    }
    return value.trim();
}
function trimStringOrUndefined(value) {
    if (typeof value !== 'string') {
        return value;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
