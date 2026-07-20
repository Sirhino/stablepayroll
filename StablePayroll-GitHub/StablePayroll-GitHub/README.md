# StablePayroll

Recurring USDC payroll on Arc Testnet: onchain vault release → Circle Developer-Controlled
Wallets → CCTP bridge (if needed) → fiat payout via Blockradar.

Blockradar's fiat withdrawal API is permissioned — it requires an approved compliance form
before issuing an API key. Until that's approved, `server/blockradar.js` returns mocked
responses that match Blockradar's real API shapes exactly (`getInstitutions`, `getQuote`,
`withdrawFiat`). Set `BLOCKRADAR_API_KEY` once you have it and every call switches to live
automatically — no other code changes needed.

## Structure

```
StablePayroll/
├── contracts/            Foundry project — PayrollVault.sol
│   ├── src/PayrollVault.sol
│   ├── script/Deploy.s.sol
│   ├── foundry.toml
│   └── remappings.txt
├── server/                Node orchestrator
│   ├── blockradar.js       fiat payout client (mocked until API key is live)
│   ├── circleWallet.js     Circle Dev-Controlled Wallets balance + transfer
│   ├── bridge.js           CCTP bridge via Bridge Kit
│   ├── payrollCycle.js     ties it all together, run per recipient
│   ├── recipients.json     sample recipient config
│   └── .env.example
└── frontend/
    └── index.html          single-file demo dashboard (wallet connect + cycle visualizer)
```

## 1. Deploy the contract (Git Bash)

Install Foundry if you haven't already:

```
curl -L https://foundry.paradigm.xyz | bash
```

```
foundryup
```

Move into the contracts folder:

```
cd contracts
```

Install forge-std:

```
forge install foundry-rs/forge-std --no-commit
```

Set your RPC URL for this session:

```
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
```

Import your deployer key into an encrypted keystore (one-time, interactive — never pass a raw
private key on the command line):

```
cast wallet import deployer --interactive
```

Deploy:

```
forge script script/Deploy.s.sol:Deploy --rpc-url $ARC_TESTNET_RPC_URL --account deployer --broadcast --legacy
```

Copy the deployed `PayrollVault` address from the output — you'll need it in `server/.env`.

## 2. Fund the vault

Approve the vault to pull USDC, then call `fund(amount)` (6 decimals) from your deployer
wallet — via `cast send` or your existing GamRemit tooling, whichever you already have wired up.

## 3. Configure the server

```
cd ../server
```

```
cp .env.example .env
```

Fill in `.env`:
- `PAYROLL_VAULT_ADDRESS` — from step 1
- `PAYROLL_ADMIN_PRIVATE_KEY` — local/dev only, never commit
- `CIRCLE_API_KEY` / `CIRCLE_ENTITY_SECRET` — from your existing Circle setup
- `PAYROLL_SOURCE_WALLET_ID` — the Circle wallet funding bridges, if used
- `BLOCKRADAR_API_KEY` — leave blank until approved; mocks kick in automatically

Install dependencies:

```
npm install
```

Edit `recipients.json` with real recipient data, then run one payroll cycle:

```
npm run payroll:run
```

## 4. Demo dashboard

Just open `frontend/index.html` in a browser — no build step. It walks through all four
steps with the mocked/live badges clearly shown, and does a real EIP-6963 wallet connect.

## Notes

- `releaseTrancheNow` bypasses the 30-day cooldown for demo purposes — remove it before any
  real deployment and keep only `releaseTranche`.
- Confirm whether Blockradar can settle USDC directly from Arc or requires a different source
  chain before assuming the CCTP bridge hop (`bridge.js`) is mandatory — check with Blockradar
  support or their docs once your account is approved.
