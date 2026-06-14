import Ajv from 'ajv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '../../config/client.config.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

export function validateConfig(config) {
  const valid = validate(config);
  if (!valid) {
    const errors = validate.errors.map(e => {
      const path = e.instancePath || 'root';
      return `${path}: ${e.message}`;
    }).join('\n  - ');
    throw new Error(`Config validation failed:\n  - ${errors}`);
  }

  // Auto-generate engagementId if missing
  if (!config.engagement.engagementId) {
    const year = new Date().getFullYear();
    const num = Math.floor(Math.random() * 900) + 100;
    config.engagement.engagementId = `MAB-${year}-${num}`;
  }

  return config;
}
