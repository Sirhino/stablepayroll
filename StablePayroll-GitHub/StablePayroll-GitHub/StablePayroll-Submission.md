# StablePayroll

**Recurring cross-border payroll on Arc — USDC in, local fiat out, no manual wires.**

Built on Arc Testnet using Circle's stablecoin-native stack: onchain payroll vault, Circle
Developer-Controlled Wallets, CCTP bridging, and Blockradar fiat settlement.

---

## One-line pitch

StablePayroll lets employers pay remote workers and contractors in USDC and have recipients
receive local fiat currency automatically each cycle — no manual wire transfers, no volatile
gas fees, no multi-day settlement delays.

---

## Problem

Cross-border payroll for remote teams and contractors — especially across corridors like
Gambia, Nigeria, and other emerging markets — is slow and expensive. Traditional wires take
days, carry high fees, and often route through intermediary banks with inconsistent local
access. Existing crypto payroll tools mostly stop at "send USDC to a wallet" and leave the
hard part — actually getting usable local currency into a recipient's bank account — as the
employee's problem.

## Solution

StablePayroll automates the entire cycle: an employer funds an onchain vault once, configures
each recipient's monthly amount and bank details, and triggers a payout cycle. From there,
everything downstream — the USDC release, any necessary cross-chain movement, currency
conversion, and the actual bank payout — happens without manual intervention.

## How it works

| Step | Component | What happens |
|---|---|---|
| 1 | **PayrollVault** (Solidity, Arc Testnet) | Employer-funded vault. Admin configures recipients (wallet, monthly amount, fiat currency, bank reference) and triggers `releaseTranche` per cycle. Enforces a 30-day cooldown to prevent accidental double-runs. |
| 2 | **Circle Developer-Controlled Wallets** | Programmatically holds and moves USDC on the employer's behalf — no manual signature per transaction, which is what makes recurring automated payroll possible. |
| 3 | **CCTP Bridge** (Circle Bridge Kit) | Moves USDC across chains if the fiat off-ramp settles from a network other than Arc. |
| 4 | **Blockradar** | Converts USDC to local fiat (NGN, KES, and others) and pays directly into the recipient's bank account or mobile money wallet. |

## Why Arc

USDC as Arc's native gas token means payroll costs stay predictable in the same currency being
paid out — no separate volatile gas token to budget for, and no fee spikes eating into payout
accuracy. Arc's sub-second finality means the onchain leg of each cycle confirms almost
instantly, so the vault release step isn't the bottleneck — the fiat settlement rail is.

## Current status

- **Onchain vault and release logic** — built and deployed on Arc Testnet
- **Circle Wallets + CCTP bridging** — integrated and functional
- **Blockradar fiat settlement** — implemented against Blockradar's real API contract
  (`getInstitutions`, `getQuote`, `withdrawFiat`), currently running against mocked responses
  that match the live API's exact shape, pending compliance approval on the Blockradar side.
  Switching to live is a configuration change (`BLOCKRADAR_API_KEY`), not a rewrite.
- **Demo dashboard** — single-page interface showing wallet connect and a step-by-step
  visualization of a payout cycle, with mocked vs. live legs clearly labeled

## Target use case

Diaspora-facing businesses, remittance-adjacent fintechs, and distributed teams paying
contractors across corridors where local banking access is inconsistent but USDC liquidity and
adoption are growing — starting with the Gambia–Nigeria corridor and expandable to other
African markets Blockradar supports.

## Tech stack

Solidity, Foundry, Circle Developer-Controlled Wallets SDK, Circle Bridge Kit (CCTP), Node.js,
viem, Blockradar API, Arc Testnet.
