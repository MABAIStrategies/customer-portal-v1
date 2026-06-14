#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateConfig } from './lib/validator.js';
import { renderTemplate } from './lib/renderer.js';
import { getDiscountTier, calculatePayback } from './lib/pricing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = yargs(hideBin(process.argv))
  .option('config', {
    alias: 'c',
    type: 'string',
    default: path.join(__dirname, '../config/client.config.json'),
    describe: 'Path to client config JSON'
  })
  .parse();

async function main() {
  const configPath = argv.config;
  if (!fs.existsSync(configPath)) {
    console.error('Config file not found:', configPath);
    process.exit(1);
  }

  const rawConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const config = validateConfig(rawConfig);

  // Build pricing data for client-side
  const allItems = config.phases.flatMap(p => p.items);
  const totalPotentialRoi = allItems.reduce((sum, i) => sum + (i.roiMonthly || 0), 0);
  const pricingData = {
    discountTiers: config.pricing.discountTiers,
    currency: config.pricing.currency,
    totalPotentialRoi,
    promoWindow: config.engagement.promoWindow
  };

  const html = renderTemplate(config, pricingData);

  const slug = config.company.name.toLowerCase().replace(/\s+/g, '-');
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const outPath = path.join(__dirname, '../output', `${slug}-portal-${date}.html`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);

  console.log('✅ Portal generated successfully');
  console.log('   File:', outPath);
  console.log('   Phases:', config.phases.length);
  console.log('   Items:', allItems.length);
  console.log('   Total Potential Monthly ROI: $' + totalPotentialRoi);
  console.log('   Integrations:', config.integrationsEnabled?.join(', ') || 'none');
}

main().catch(err => {
  console.error('Generation failed:', err.message);
  process.exit(1);
});
