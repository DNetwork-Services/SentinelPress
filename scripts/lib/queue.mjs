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

/**
 * Moves a post's JSON and any associated slide images from one queue
 * stage to another (e.g. pending -> approved). Used by resolve-approval.mjs
 * when a Telegram approve/reject tap comes back through the webhook.
 */
export function movePost(accountId, post, fromStage, toStage) {
  const fromDir = queueDir(accountId, fromStage);
  const toDir = queueDir(accountId, toStage);

  const filesToMove = [...(post.render?.slideImages ?? [])];
  if (post.render?.reelVideo) filesToMove.push(post.render.reelVideo);

  for (const fileName of filesToMove) {
    const src = path.join(fromDir, fileName);
    if (fs.existsSync(src)) {
      fs.renameSync(src, path.join(toDir, fileName));
    }
  }

  const oldJsonPath = path.join(fromDir, `${post.id}.json`);
  if (fs.existsSync(oldJsonPath)) {
    fs.unlinkSync(oldJsonPath);
  }

  const newJsonPath = path.join(toDir, `${post.id}.json`);
  fs.writeFileSync(newJsonPath, JSON.stringify(post, null, 2) + '\n');
}

/**
 * Searches every active account's pending queue for a post with a
 * matching approvalHash. Returns { account, post } or null.
 */
export function findPendingByApprovalHash(accounts, approvalHash) {
  for (const account of accounts) {
    const pending = listQueue(account.accountId, 'pending');
    const match = pending.find((p) => p.approvalHash === approvalHash);
    if (match) return { account, post: match };
  }
  return null;
}
