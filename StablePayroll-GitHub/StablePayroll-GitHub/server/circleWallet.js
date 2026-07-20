/**
 * Thin wrapper around Circle's Developer-Controlled Wallets SDK.
 * Requires CIRCLE_API_KEY + CIRCLE_ENTITY_SECRET (see .env.example).
 *
 * Entity secret registration is a one-time manual step you must do yourself:
 * https://developers.circle.com/wallets/dev-controlled/register-entity-secret
 * Do not skip this — the SDK will reject calls without a registered secret.
 */

const { initiateDeveloperControlledWalletsClient } = require('@circle-fin/developer-controlled-wallets');
const { randomUUID } = require('crypto');

function getClient() {
  if (!process.env.CIRCLE_API_KEY || !process.env.CIRCLE_ENTITY_SECRET) {
    throw new Error('CIRCLE_API_KEY / CIRCLE_ENTITY_SECRET not set — see server/.env.example');
  }
  return initiateDeveloperControlledWalletsClient({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  });
}

/** Balances are NOT available via client.getWallet/getWallets — must use this endpoint. */
async function getWalletBalance(walletId) {
  const client = getClient();
  const response = await client.getWalletTokenBalance({ id: walletId });
  return response.data.tokenBalances;
}

/** Transfers USDC from a Circle developer-controlled wallet to a destination address. */
async function transferUsdc({ walletId, destinationAddress, amount, tokenId }) {
  const client = getClient();
  const response = await client.createTransaction({
    walletId,
    tokenId, // Arc USDC token id from your Circle Wallets configuration
    destinationAddress,
    amounts: [String(amount)],
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
    idempotencyKey: randomUUID(),
  });
  return response.data;
}

/** Polls until the transaction reaches a terminal state. */
async function waitForTransaction(transactionId, { intervalMs = 3000, timeoutMs = 120000 } = {}) {
  const client = getClient();
  const terminal = new Set(['COMPLETE', 'FAILED', 'DENIED', 'CANCELLED']);
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const response = await client.getTransaction({ id: transactionId });
    const state = response.data.transaction.state;
    if (terminal.has(state)) return response.data.transaction;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error(`Transaction ${transactionId} did not reach a terminal state within timeout`);
}

module.exports = { getWalletBalance, transferUsdc, waitForTransaction };
