import { loadActiveAccounts } from './lib/config.mjs';
import { movePost, findPendingByApprovalHash } from './lib/queue.mjs';
import { alertFailure } from './lib/alert.mjs';

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Environment variable ${name} is not set.`);
  return value;
}

async function main() {
  const approvalHash = requireEnv('DISPATCH_APPROVAL_HASH');
  const action = requireEnv('DISPATCH_ACTION'); // "approve" | "reject"

  if (!['approve', 'reject'].includes(action)) {
    throw new Error(`Unknown action "${action}" — expected "approve" or "reject".`);
  }

  const accounts = loadActiveAccounts();
  const match = findPendingByApprovalHash(accounts, approvalHash);

  if (!match) {
    // Not fatal — could be a duplicate webhook delivery (Telegram retries
    // on non-2xx) after the first one already moved the post. Log and exit
    // cleanly rather than failing the whole workflow run.
    console.log(`No pending post found with approvalHash "${approvalHash}". Already handled, or stale tap. Nothing to do.`);
    return;
  }

  const { account, post } = match;
  const toStage = action === 'approve' ? 'approved' : 'rejected';

  const timestampField = action === 'approve' ? 'approvedAt' : 'rejectedAt';
  movePost(account.accountId, { ...post, status: toStage, [timestampField]: new Date().toISOString() }, 'pending', toStage);

  console.log(`Moved "${post.article.title}" (${account.displayName}) to ${toStage}/.`);
}

main().catch(async (err) => {
  console.error('[resolve-approval] Fatal error:', err);
  await alertFailure('resolve-approval', err);
  process.exit(1);
});
