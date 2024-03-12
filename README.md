
## Getting Started
Always instantiate these imports before using the create functions
```js
import { ItemType, Kettle } from 'kettle-core-js';
import { parseUnits } from '@ethersproject/units';

const KETTLE_ADDRESS = "0x58fD646F4d8E8A6D1C7b074b9774e91483BA0601" // for blast_sepolia
const MONTH_SECONDS = (365 * 24 * 60 * 60) / 12;
const FEE = "250";
const FEE_RECIPIENT = "0xAf810826679816a0330F786f0589D224DdEd24Ff";

const kettle = new Kettle(signer, KETTLE_ADDRESS);
```

### Create Loan Offer
After using the imports from above, create and sign a new loan offer.
Loan Offers are created by lenders to be taken by borrowers to start a new loan.

```js
// amount is $1,000 and rate is 20%
// we need to parseUnits(1000, 18) for amount and parseUnits(20, 2) for rate
const { rate, amount, duration, expiration } = inputs;

const loanOffer = {
  collection: '0x...',
  itemType: ItemType.ERC721,
  identifier: 1,
  currency: '0x...',
  amount: parseUnits(amount, 18),
  rate: parseUnits(rate, 2),
  defaultRate: parseUnits(rate, 2),
  fee: FEE,
  recipient: FEE_RECIPIENT,
  duration: duration,
  gracePeriod: MONTH_SECONDS,
  expiration: expiration
}

const steps = await kettle.createLoanOffer(loanOffer);
const approvals = steps.filter((s) => s.type === "approval") as ApprovalAction[];
for (const step of approvals) {
  await step.approve();
}

const createStep = steps.find((s) => s.type === "create") as CreateOrderAction;
const { offer, type, signature } = await createStep.createOrder();
```

### Create Borrow Offer
After using the imports from above, create and sign a new borrow offer.
Borrow offers are created by borrowers to be taken by lenders to start a new loan.
```js
const { rate, amount, duration, expiration } = inputs;

const borrowOffer = {
  collection: '0x...',
  itemType: ItemType.ERC721,
  identifier: 1,
  currency: '0x...',
  amount: parseUnits(amount, 18),
  rate: parseUnits(rate, 2),
  defaultRate: parseUnits(rate, 2),
  fee: FEE,
  recipient: FEE_RECIPIENT,
  duration: duration,
  gracePeriod: MONTH_SECONDS,
  expiration: expiration
}

const steps = await kettle.createBorrowOffer(borrowOffer);
const approvals = steps.filter((s) => s.type === "approval") as ApprovalAction[];
for (const step of approvals) {
  await step.approve();
}

const createStep = steps.find((s) => s.type === "create") as CreateOrderAction;
const { offer, type, signature } = await createStep.createOrder();
```

### Create Ask Offer
After using the imports from above, create and sign a new ask offer.
Ask Offers are created by sellers to be taken by buyers to sell an asset.
```js
const { rate, amount, expiration } = inputs;

const askOffer = {
  collection: '0x...',
  itemType: ItemType.ERC721,
  identifier: 1,
  currency: '0x...',
  amount: parseUnits(amount, 18),
  fee: FEE,
  recipient: FEE_RECIPIENT,
  expiration: expiration
}

const steps = await kettle.createAskOffer(askOffer);
const approvals = steps.filter((s) => s.type === "approval") as ApprovalAction[];
for (const step of approvals) {
  await step.approve();
}

const createStep = steps.find((s) => s.type === "create") as CreateOrderAction;
const { offer, type, signature } = await createStep.createOrder();
```

### Create Bid Offer
After using the imports from above, create and sign a new bid offer.
Bid Offers are created by buyers to be taken by sellers to sell an asset.
```js
const { rate, amount, expiration } = inputs;

const bidOffer = {
  collection: '0x...',
  itemType: ItemType.ERC721,
  identifier: 1,
  currency: '0x...',
  amount: parseUnits(amount, 18),
  fee: FEE,
  recipient: FEE_RECIPIENT,
  expiration: expiration
}

const steps = await kettle.createBidOffer(askOffer);
const approvals = steps.filter((s) => s.type === "approval") as ApprovalAction[];
for (const step of approvals) {
  await step.approve();
}

const createStep = steps.find((s) => s.type === "create") as CreateOrderAction;
const { offer, type, signature } = await createStep.createOrder();
```
