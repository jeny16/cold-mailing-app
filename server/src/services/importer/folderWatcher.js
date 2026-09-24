import chokidar from 'chokidar';
import fs from 'fs';
import path from 'path';
import logger from '../../config/logger.js';
import { processJobsImport } from './jsonImporter.js';

let watcher = null;
const processingFiles = new Set();

/**
 * Initializes the folder watcher on data/incoming/
 */
export function startFolderWatcher(incomingDir = 'data/incoming') {
  const resolvedDir = path.resolve(process.cwd(), incomingDir);

  if (!fs.existsSync(resolvedDir)) {
    fs.mkdirSync(resolvedDir, { recursive: true });
  }

  logger.info(`[Watcher] Watching folder for new JSON files: ${resolvedDir}`);

  watcher = chokidar.watch(resolvedDir, {
    ignored: /(^|[\/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: {
      stabilityThreshold: 1500,
      pollInterval: 200,
    },
  });

  watcher.on('add', async (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.json') return;

    if (processingFiles.has(filePath)) return;
    processingFiles.add(filePath);

    const filename = path.basename(filePath);
    logger.info(`[Watcher] New JSON detected: ${filename}`);

    try {
      // Read file contents
      const content = fs.readFileSync(filePath, 'utf-8');

      // Process import
      await processJobsImport({
        content,
        filename,
        filePath,
        source: 'Folder Watcher (AI Agent)',
      });
    } catch (err) {
      logger.error({ filePath, error: err.message }, '[Watcher] Error processing file from folder');
    } finally {
      processingFiles.delete(filePath);
    }
  });

  watcher.on('error', (err) => {
    logger.error({ error: err.message }, '[Watcher] Watcher error');
  });

  return watcher;
}

export function stopFolderWatcher() {
  if (watcher) {
    watcher.close();
    logger.info('[Watcher] Folder watcher stopped');
    watcher = null;
  }
}

export default {
  startFolderWatcher,
  stopFolderWatcher,
};
