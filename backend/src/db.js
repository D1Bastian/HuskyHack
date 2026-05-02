import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const dataDir = path.join(backendRoot, "data");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, "artstories.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    inspiration TEXT,
    meaning TEXT,
    body TEXT,
    image_path TEXT NOT NULL,
    image_filename TEXT NOT NULL,
    phash TEXT NOT NULL,
    tile_phashes TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_posts_phash ON posts(phash);
`);

try {
  db.exec(`ALTER TABLE posts ADD COLUMN tile_phashes TEXT NOT NULL DEFAULT '[]'`);
} catch {
  // column already exists
}

const insertStmt = db.prepare(`
  INSERT INTO posts (title, author, inspiration, meaning, body, image_path, image_filename, phash, tile_phashes)
  VALUES (@title, @author, @inspiration, @meaning, @body, @image_path, @image_filename, @phash, @tile_phashes)
`);

const listStmt = db.prepare(`
  SELECT id, title, author, inspiration, meaning, body, image_filename, phash, created_at
  FROM posts ORDER BY created_at DESC
`);

const getStmt = db.prepare(`
  SELECT id, title, author, inspiration, meaning, body, image_path, image_filename, phash, created_at
  FROM posts WHERE id = ?
`);

const allPhashStmt = db.prepare(`
  SELECT id, title, author, inspiration, meaning, body, image_path, image_filename, phash, tile_phashes
  FROM posts
`);

const deleteStmt = db.prepare(`DELETE FROM posts WHERE id = ?`);

export function createPost(post) {
  const result = insertStmt.run(post);
  return getPost(result.lastInsertRowid);
}

export function listPosts() {
  return listStmt.all().map(toPublicPost);
}

export function getPost(id) {
  const row = getStmt.get(id);
  return row ? toPublicPost(row) : null;
}

export function getAllPostsWithHash() {
  return allPhashStmt.all();
}

export function deletePost(id) {
  const result = deleteStmt.run(id);
  return result.changes > 0;
}

function toPublicPost(row) {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    inspiration: row.inspiration || "",
    meaning: row.meaning || "",
    body: row.body || "",
    image_url: `/media/posts/${row.image_filename}`,
    image_filename: row.image_filename,
    image_path: row.image_path || null,
    phash: row.phash,
    created_at: row.created_at,
  };
}

export default db;
