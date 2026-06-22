import OpenAI from 'openai';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../mab_portal.db');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedCatalog() {
  const db = new Database(dbPath);
  const items = db.prepare('SELECT * FROM phase_items').all();

  for (const item of items) {
    const text = `${item.name}. ${item.description}. Category: ${item.category}`;
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1536
    });

    const vec = new Float32Array(embedding.data[0].embedding);
    db.prepare(`
      INSERT OR REPLACE INTO item_catalog_vectors (item_id, embedding, metadata)
      VALUES (?, ?, ?)
    `).run(item.item_id, vec.buffer, JSON.stringify({ name: item.name, category: item.category }));
  }
  console.log(`Embedded ${items.length} items.`);
  db.close();
}
