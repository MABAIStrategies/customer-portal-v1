import { getDb } from './init.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function seed() {
  const db = getDb();
  const catalogPath = path.join(__dirname, 'seed/master_catalog.json');
  if (!fs.existsSync(catalogPath)) {
    console.log('No master catalog found, skipping seed.');
    db.close();
    return;
  }
  const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

  const insert = db.prepare(`
    INSERT OR REPLACE INTO phase_items
    (item_id, name, description, category, roi_monthly, hours_saved, price_one_time, price_monthly, is_fulcrum)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of catalog) {
    insert.run(
      item.itemId, item.name, item.description, item.category,
      item.roiMonthly, item.hoursSavedMonthly, item.priceOneTime, item.priceMonthly,
      item.isFulcrum ? 1 : 0
    );
  }
  console.log(`Seeded ${catalog.length} phase items.`);
  db.close();
}
