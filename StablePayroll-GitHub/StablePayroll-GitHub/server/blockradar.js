/**
 * Blockradar fiat withdrawal client.
 *
 * Matches the shape of Blockradar's real "Withdraw Fiat" API:
 *   GET  /v1/wallets/{walletId}/withdraw/fiat/institutions
 *   POST /v1/wallets/{walletId}/withdraw/fiat/quote
 *   POST /v1/wallets/{walletId}/withdraw/fiat
 *
 * BLOCKRADAR_API_KEY is only issued after Blockradar approves your business
 * compliance form. Until then, USE_MOCK stays true and every call below
 * returns realistic canned data with the exact same field names Blockradar
 * uses, so nothing downstream needs to change when the real key arrives —
 * just flip USE_MOCK to false (or unset it) once BLOCKRADAR_API_KEY is set.
 */

const BLOCKRADAR_BASE_URL = 'https://api.blockradar.co/v1';
const USE_MOCK = !process.env.BLOCKRADAR_API_KEY;

// Canned institution list per currency, matching Blockradar's real response shape.
const MOCK_INSTITUTIONS = {
  NGN: [
    { code: 'GTBINGLA', name: 'Guaranty Trust Bank' },
    { code: 'ABNGNGLA', name: 'Access Bank' },
    { code: 'ZEIBNGLA', name: 'Zenith Bank' },
    { code: 'OPAYNGPC', name: 'OPay' },
    { code: 'MONIPOINT', name: 'Moniepoint MFB' },
    { code: 'PALMPAY01', name: 'PalmPay' },
  ],
  KES: [
    { code: 'MPESA', name: 'M-Pesa' },
    { code: 'EQBLKENA', name: 'Equity Bank' },
  ],
  TZS: [{ code: 'CRDBTZTZ', name: 'CRDB Bank' }],
  UGX: [{ code: 'CENTEUGA', name: 'Centenary Bank' }],
  MWK: [{ code: 'NBSMWMW', name: 'NBS Bank' }],
};

function assertMockCurrency(currency) {
  if (!MOCK_INSTITUTIONS[currency]) {
    throw new Error(`[blockradar mock] No mock institutions configured for currency ${currency}`);
  }
}

async function realFetch(path, options = {}) {
  const res = await fetch(`${BLOCKRADAR_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.BLOCKRADAR_API_KEY,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Blockradar API error ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * GET /v1/wallets/{walletId}/withdraw/fiat/institutions
 */
async function getInstitutions({ walletId, currency, amount, assetId }) {
  if (USE_MOCK) {
    assertMockCurrency(currency);
    return {
      statusCode: 200,
      message: 'Institutions fetched successfully (MOCKED — pending Blockradar API approval)',
      data: MOCK_INSTITUTIONS[currency],
    };
  }
  const query = new URLSearchParams({ currency, amount: String(amount), assetId });
  return realFetch(`/wallets/${walletId}/withdraw/fiat/institutions?${query}`);
}

/**
 * POST /v1/wallets/{walletId}/withdraw/fiat/quote
 * Returns an RFQ-style quote: exchange rate, fee, and net payout amount.
 */
async function getQuote({ walletId, currency, amount, assetId, institutionCode }) {
  if (USE_MOCK) {
    assertMockCurrency(currency);
    // Illustrative static rates for demo purposes only — not live market data.
    const MOCK_RATES = { NGN: 1550, KES: 129, TZS: 2600, UGX: 3700, MWK: 1735 };
    const rate = MOCK_RATES[currency];
    const feePct = 0.005; // 0.5% flat demo fee
    const grossFiat = Number(amount) * rate;
    const fee = grossFiat * feePct;
    const netFiat = grossFiat - fee;

    return {
      statusCode: 200,
      message: 'Quote generated successfully (MOCKED — pending Blockradar API approval)',
      data: {
        quoteId: `mock_quote_${Date.now()}`,
        currency,
        institutionCode,
        rate,
        amountUsdc: Number(amount),
        grossFiatAmount: Number(grossFiat.toFixed(2)),
        feeFiatAmount: Number(fee.toFixed(2)),
        netFiatAmount: Number(netFiat.toFixed(2)),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    };
  }
  return realFetch(`/wallets/${walletId}/withdraw/fiat/quote`, {
    method: 'POST',
    body: JSON.stringify({ currency, amount, assetId, institutionCode }),
  });
}

/**
 * POST /v1/wallets/{walletId}/withdraw/fiat
 * Executes the payout against a previously accepted quote.
 */
async function withdrawFiat({ walletId, quoteId, accountNumber, accountName, institutionCode }) {
  if (USE_MOCK) {
    return {
      statusCode: 200,
      message: 'Fiat withdrawal simulated (MOCKED — pending Blockradar API approval)',
      data: {
        withdrawalId: `mock_withdrawal_${Date.now()}`,
        quoteId,
        status: 'SIMULATED_SUCCESS',
        institutionCode,
        accountNumber,
        accountName,
        submittedAt: new Date().toISOString(),
      },
    };
  }
  return realFetch(`/wallets/${walletId}/withdraw/fiat`, {
    method: 'POST',
    body: JSON.stringify({ quoteId, accountNumber, accountName, institutionCode }),
  });
}

module.exports = { getInstitutions, getQuote, withdrawFiat, USE_MOCK };
