/**
 * Bridges USDC from Arc Testnet to a destination chain via Circle Bridge Kit (CCTP).
 *
 * Only needed if Blockradar settlement requires USDC on a chain other than Arc.
 * Confirm Blockradar's supported source chains before assuming this hop is required —
 * if Blockradar can settle directly from Arc, skip this module entirely.
 */

const { BridgeKit } = require('@circle-fin/bridge-kit');
const { createCircleWalletsAdapter } = require('@circle-fin/adapter-circle-wallets');

async function bridgeToDestination({ amount, destinationChain, destinationRecipientAddress }) {
  const kit = new BridgeKit();

  const adapter = createCircleWalletsAdapter({
    apiKey: process.env.CIRCLE_API_KEY,
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
    walletId: process.env.PAYROLL_SOURCE_WALLET_ID,
  });

  kit.on('*', (payload) => {
    console.log(`[bridge] ${payload.event}:`, payload.values?.state ?? payload.values);
  });

  const result = await kit.bridge({
    from: { adapter, chain: 'Arc_Testnet' },
    to: {
      recipientAddress: destinationRecipientAddress,
      chain: destinationChain, // e.g. "Base_Sepolia"
      useForwarder: true,
    },
    amount: String(amount),
  });

  if (result.state === 'error') {
    const failedStep = result.steps.find((s) => s.state === 'error');
    throw new Error(`Bridge failed at ${failedStep?.name}: ${failedStep?.error}`);
  }

  return result;
}

module.exports = { bridgeToDestination };
