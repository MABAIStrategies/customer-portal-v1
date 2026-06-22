import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../mab_portal.db');

export function cosineSearch(queryVec, topK = 5) {
  const db = new Database(dbPath);
  const rows = db.prepare('SELECT item_id, embedding, metadata FROM item_catalog_vectors').all();

  const results = rows.map(row => {
    const vec = new Float32Array(row.embedding);
    const dot = queryVec.reduce((sum, v, i) => sum + v * vec[i], 0);
    const magA = Math.sqrt(queryVec.reduce((s, v) => s + v * v, 0));
    const magB = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    const cos = dot / (magA * magB);
    return { item_id: row.item_id, metadata: JSON.parse(row.metadata), score: cos };
  }).sort((a, b) => b.score - a.score).slice(0, topK);

  db.close();
  return results;
}
