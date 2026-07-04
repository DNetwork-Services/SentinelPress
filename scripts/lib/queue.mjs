import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

export function queueDir(accountId, stage) {
  const dir = path.join(DATA_DIR, accountId, 'queue', stage);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function slugify(text, maxLen = 80) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, maxLen)
    .replace(/-+$/, '');
}

export function writePendingPost(accountId, post) {
  const dir = queueDir(accountId, 'pending');
  const filePath = path.join(dir, `${post.id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(post, null, 2) + '\n');
  return filePath;
}

export function listQueue(accountId, stage) {
  const dir = queueDir(accountId, stage);
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
}
