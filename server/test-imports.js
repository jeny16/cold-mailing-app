const files = [
  './src/config/logger.js',
  './src/config/db.js',
  './src/models/Job.js',
  './src/services/mail/imapReplyTracker.js',
  './src/services/queue/queueService.js',
  './src/services/importer/folderWatcher.js'
];
(async () => {
  for (const file of files) {
    console.log('Importing', file);
    try {
      await import(file);
      console.log('Imported', file);
    } catch (e) {
      console.log('Failed', file, e);
    }
  }
  process.exit(0);
})();
