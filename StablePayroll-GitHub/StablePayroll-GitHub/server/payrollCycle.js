/**
 * Orchestrates one payroll cycle for a single recipient:
 *   1. Release USDC tranche from PayrollVault on Arc      (onchain, real)
 *   2. (optional) Bridge USDC to destination chain via CCTP (onchain, real)
 *   3. Get Blockradar institutions + quote                (mocked until API key approved)
 *   4. Execute Blockradar fiat withdrawal                  (mocked until API key approved)
 *
 * Run with: node payrollCycle.js
 * Requires ARC_TESTNET_RPC_URL, PAYROLL_VAULT_ADDRESS, and either an admin
 * private key (local/dev only) or a wired signer for production use.
 */

require('dotenv').config();
const { createPublicClient, createWalletClient, http, parseAbi } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const blockradar = require('./blockradar');
const recipients = require('./recipients.json');

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: [process.env.ARC_TESTNET_RPC_URL || 'https://rpc.testnet.arc.network'] } },
};

const VAULT_ABI = parseAbi([
  'function releaseTrancheNow(uint256 id) external',
  'function recipients(uint256 id) view returns (address wallet, uint256 monthlyAmount, string fiatCurrency, string bankAccountRef, bool active)',
  'event TrancheReleased(uint256 indexed id, address indexed wallet, uint256 amount, uint256 timestamp)',
]);

async function runCycleForRecipient(recipientConfig) {
  const { onchainId, walletId, amountUsdc, fiatCurrency, institutionCode, accountNumber, accountName, assetId } =
    recipientConfig;

  console.log(`\n=== Payroll cycle: recipient ${onchainId} (${fiatCurrency}) ===`);

  // Step 1 — release onchain USDC tranche (demo mode: releaseTrancheNow bypasses 30-day cooldown)
  const account = privateKeyToAccount(process.env.PAYROLL_ADMIN_PRIVATE_KEY);
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });

  const txHash = await walletClient.writeContract({
    address: process.env.PAYROLL_VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: 'releaseTrancheNow',
    args: [BigInt(onchainId)],
  });
  console.log(`  onchain release tx: ${txHash}`);
  await publicClient.waitForTransactionReceipt({ hash: txHash });
  console.log('  release confirmed on Arc');

  // Step 2 — resolve fiat institutions + quote via Blockradar (mocked until API key is live)
  const institutions = await blockradar.getInstitutions({
    walletId,
    currency: fiatCurrency,
    amount: amountUsdc,
    assetId,
  });
  console.log(`  institutions available (${blockradar.USE_MOCK ? 'MOCK' : 'LIVE'}):`, institutions.data.map((i) => i.name));

  const quote = await blockradar.getQuote({
    walletId,
    currency: fiatCurrency,
    amount: amountUsdc,
    assetId,
    institutionCode,
  });
  console.log(
    `  quote: ${amountUsdc} USDC -> ${quote.data.netFiatAmount} ${fiatCurrency} ` +
      `(rate ${quote.data.rate}, fee ${quote.data.feeFiatAmount})`
  );

  // Step 3 — execute the fiat withdrawal
  const withdrawal = await blockradar.withdrawFiat({
    walletId,
    quoteId: quote.data.quoteId,
    accountNumber,
    accountName,
    institutionCode,
  });
  console.log(`  withdrawal status: ${withdrawal.data.status} (id: ${withdrawal.data.withdrawalId})`);

  return { txHash, quote: quote.data, withdrawal: withdrawal.data };
}

async function main() {
  for (const recipient of recipients) {
    await runCycleForRecipient(recipient);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Payroll cycle failed:', err);
    process.exit(1);
  });
}

module.exports = { runCycleForRecipient };
