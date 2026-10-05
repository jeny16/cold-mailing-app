const deps = [
  'chokidar', 'cors', 'dotenv', 'express', 'mongoose', 'multer', 'nodemailer', 'pino', 'pino-pretty', 'uuid', 'zod'
];

(async () => {
  for (const dep of deps) {
    console.log(`Testing import ${dep}`);
    try {
      const promise = import(dep);
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 2000));
      await Promise.race([promise, timeout]);
      console.log(`Successfully imported ${dep}`);
    } catch (err) {
      console.error(`Failed to import ${dep}:`, err.message);
    }
  }
  process.exit(0);
})();
