// Passenger loads CommonJS startup files; the application remains ESM.
import('./dist/local.js').catch(() => {
  console.error('Equipora API startup failed');
  process.exitCode = 1;
});
