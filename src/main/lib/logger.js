'use strict';

/**
 * Lightweight main-process logger with user-path redaction for console output.
 * Does not persist to disk; use for stdout/stderr-safe operational messages.
 */

const LEVEL = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

/**
 * Replace common user home / profile path patterns so logs are safer to share.
 * @param {string} input
 * @returns {string}
 */
function msc_redactUserPaths(input) {
  let s = String(input);
  const profile = process.env.USERPROFILE || process.env.HOME;
  if (profile && profile.length > 2) {
    const norm = profile.replace(/\\/g, '/');
    const esc = norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      s = s.replace(new RegExp(esc, 'gi'), '<USER_PATH>');
    } catch {
      /* ignore bad env */
    }
  }
  s = s.replace(/[A-Za-z]:\\Users\\[^\\]+\\/gi, '<USER_PATH>\\');
  s = s.replace(/[A-Za-z]:\\Users\\[^\\/]+(?=\\|$)/gi, '<USER_PATH>');
  s = s.replace(/\/Users\/[^/]+\//g, '<USER_PATH>/');
  s = s.replace(/\/home\/[^/]+\//g, '<USER_PATH>/');
  return s;
}

/**
 * @param {unknown} arg
 * @returns {string}
 */
function msc_serializeLogArg(arg) {
  if (arg == null) return String(arg);
  if (typeof arg === 'string') return msc_redactUserPaths(arg);
  if (arg instanceof Error) {
    return msc_redactUserPaths(arg.stack || arg.message || String(arg));
  }
  if (typeof arg === 'object') {
    try {
      return msc_redactUserPaths(JSON.stringify(arg));
    } catch {
      return msc_redactUserPaths(String(arg));
    }
  }
  return msc_redactUserPaths(String(arg));
}

/**
 * @param {typeof LEVEL[keyof typeof LEVEL]} level
 * @param {unknown[]} args
 */
function msc_logAt(level, ...args) {
  const parts = args.map(msc_serializeLogArg);
  const prefix = `[VPE ${level}]`;
  if (level === LEVEL.ERROR) {
    console.error(prefix, ...parts);
  } else if (level === LEVEL.WARN) {
    console.warn(prefix, ...parts);
  } else {
    console.log(prefix, ...parts);
  }
}

function msc_logInfo(...args) {
  msc_logAt(LEVEL.INFO, ...args);
}

function msc_logWarn(...args) {
  msc_logAt(LEVEL.WARN, ...args);
}

function msc_logError(...args) {
  msc_logAt(LEVEL.ERROR, ...args);
}

module.exports = {
  LEVEL,
  msc_redactUserPaths,
  msc_logInfo,
  msc_logWarn,
  msc_logError,
};
