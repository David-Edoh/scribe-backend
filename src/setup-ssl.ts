import dotenv from 'dotenv';

// Ensure .env is loaded for test environments before reading PG_CA_BASE64
dotenv.config();

// const base64 = process.env.PG_CA_BASE64;
// if (base64) {
//   try {
//     const cert = Buffer.from(base64, 'base64').toString('utf8');
//     // Store the decoded cert in memory for database drivers to use
//     process.env.PG_CA_CERT = cert;

//     // eslint-disable-next-line no-console
//     console.log('[setup-ssl] Loaded PG CA cert from environment (no file written)');
//   } catch (e) {
//     // eslint-disable-next-line no-console
//     console.warn('[setup-ssl] Failed to decode PG CA cert:', e);
//   }
// } else {
//   // eslint-disable-next-line no-console
//   console.log('[setup-ssl] No PG_CA_BASE64 in environment, skipping');
// }

export function getPGCACert(): string | undefined {
  return process.env.PG_CA_CERT;
}
