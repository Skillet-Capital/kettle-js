
## Getting Started
Always instantiate these imports before using the create functions
```js
import { ItemType, Kettle } from 'kettle-core-js';
import { parseUnits } from '@ethersproject/units';

const MONTH_SECONDS = (365 * 24 * 60 * 60) / 12;
const { fee, recipient } = DEFAULT_FEE_INPUTS;
```

### Create Loan Offer
After using the imports from above, create and sign a new loan offer.
Loan Offers are created by lenders to be taken by borrowers to start a new loan.

```js
const { rate, amount, duration, expiration } = inputs;

const loanOffer = {
  collection: '0x...',
  itemType: ItemType.ERC721,
  identifier: 1,
  currency: '0x...',
  amount: parseUnits(amount, 18),
  rate: parseUnits(rate, 2),
  defaultRate: parseUnits(rate, 2),
  fee: parseUnits(fee, 2),
  recipient: recipient,
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
  fee: parseUnits(fee, 2),
  recipient: recipient,
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
  fee: parseUnits(fee, 2),
  recipient: recipient,
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
  fee: parseUnits(fee, 2),
  recipient: recipient,
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
