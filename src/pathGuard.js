import { lstatSync, realpathSync, statSync } from 'fs';
import { basename, delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'path';

export const ALLOWED_DIRS_ENV = 'IMAGE_TOOLS_ALLOWED_DIRS';

/**
 * Return the real paths of the directories tool calls may read and write.
 *
 * Read on every call so the server honours the environment it was started with
 * and tests can point it at a temporary directory.
 *
 * @returns {string[]} Real paths from IMAGE_TOOLS_ALLOWED_DIRS, or process.cwd() if unset.
 */
export function getAllowedRoots() {
  const entries = (process.env[ALLOWED_DIRS_ENV] || '').split(delimiter).filter(Boolean);
  if (entries.length === 0) {
    entries.push(process.cwd());
  }
  return entries.map((entry) => {
    try {
      return realpathSync(entry);
    } catch (error) {
      throw new Error(
        `${ALLOWED_DIRS_ENV} entry ${entry} cannot be resolved (${error.code}). ` +
        'Create the directory or remove it from the list.',
      );
    }
  });
}

/**
 * Report whether a path exists without following a final symlink.
 *
 * @param {string} path - Absolute path to check.
 * @returns {boolean} True if something (including a dangling symlink) is at the path.
 */
export function pathExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return false;
    }
    throw error;
  }
}

function realpathOfNearestExisting(absolutePath, label, requestedPath) {
  const missing = [];
  let current = absolutePath;
  while (!pathExists(current)) {
    missing.unshift(basename(current));
    current = dirname(current);
  }
  try {
    return join(realpathSync(current), ...missing);
  } catch (error) {
    throw new Error(
      `${label} ${requestedPath} cannot be resolved: ${current} is a broken or looping ` +
      `symlink (${error.code}). Point it at a real file or use a different path.`,
    );
  }
}

function isInside(root, target) {
  const rel = relative(root, target);
  if (rel === '') {
    return true;
  }
  return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`);
}

/**
 * Resolve a requested path and require that it lies inside an allowed root.
 *
 * Symlinks are resolved on the path itself or, if it does not exist yet, on its
 * nearest existing ancestor, so a link inside a root cannot reach outside it.
 *
 * @param {string} requestedPath - Path supplied by the tool call.
 * @param {string} label - Argument name used in error messages, e.g. 'outputPath'.
 * @returns {string} The resolved real path.
 * @throws {Error} If the path is empty, unresolvable, or outside every allowed root.
 */
export function resolveAllowedPath(requestedPath, label) {
  if (typeof requestedPath !== 'string' || requestedPath === '') {
    throw new Error(`${label} must be a non-empty string.`);
  }
  const roots = getAllowedRoots();
  const realPath = realpathOfNearestExisting(resolve(requestedPath), label, requestedPath);
  if (!roots.some((root) => isInside(root, realPath))) {
    const shown = realPath === requestedPath ? requestedPath : `${requestedPath} (${realPath})`;
    throw new Error(
      `${label} ${shown} is outside the allowed directories (${roots.join(', ')}). ` +
      `Set ${ALLOWED_DIRS_ENV} to permit it.`,
    );
  }
  return realPath;
}

/**
 * Report whether two resolved paths name the same file or directory.
 *
 * Compares device and inode when both exist, which also catches hard links and
 * case-only differences on case-insensitive filesystems.
 *
 * @param {string} first - Resolved real path.
 * @param {string} second - Resolved real path.
 * @returns {boolean} True if both paths refer to the same filesystem object.
 */
export function isSameFile(first, second) {
  if (first === second) {
    return true;
  }
  if (!pathExists(first) || !pathExists(second)) {
    return false;
  }
  const a = statSync(first);
  const b = statSync(second);
  return a.dev === b.dev && a.ino === b.ino;
}
