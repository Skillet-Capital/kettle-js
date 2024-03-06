import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

import { expect } from "chai";
import { parseEther, parseUnits } from "ethers";
import { ethers } from "hardhat";

import { ItemType, MAX_INT, ADDRESS_ZERO, BYTES_ZERO } from "../src/constants";

import { describeWithFixture } from "./utils/setup";
import { LoanOffer } from "../src/types";

const MONTH_SECONDS = 30 * 24 * 60 * 60;

describeWithFixture("take a loan offer", (fixture) => {
  let principal: bigint;
  let tokenId: bigint | number;
  
  let offer: LoanOffer;
  let signature: string;

  beforeEach(async () => {
    const { signer, recipient, kettle, testErc721, testErc20 } = fixture;

    tokenId = 1;

    principal = parseUnits("10000", 6);
    await testErc20.mint(signer, principal);

    const steps = await kettle.connect(signer).createLoanOffer({
      collection: await testErc721.getAddress(),
      criteria: 0,
      itemType: 0,
      identifier: tokenId,
      size: 1,
      currency: await testErc20.getAddress(),
      totalAmount: principal,
      maxAmount: principal,
      minAmount: principal,
      rate: parseUnits("0.1", 4),
      defaultRate: parseUnits("0.1", 4),
      fee: parseUnits("0.1", 4),
      recipient: await recipient.getAddress(),
      period: MONTH_SECONDS,
      gracePeriod: MONTH_SECONDS,
      installments: 12,
      expiration: await time.latest() + MONTH_SECONDS,
    });

    const approvals = steps.filter((s) => s.type === "approval");
    for (const step of approvals) {
      await step.transact();
    }

    const createStep = steps.find((s) => s.type === "create");
    ({ offer, signature } = await createStep!.create());
  })

  it("should take a loan offer", async () => {
    const { taker, kettle, testErc721, testErc20, testErc1155 } = fixture;

    await testErc721.mint(taker, tokenId);

    const steps = await kettle.connect(taker).takeLoanOffer(
      principal,
      offer,
      signature
    );

    const approvals = steps.filter((s) => s.type === "approval");
    for (const step of approvals) {
      await step.transact();
    }

    const takeStep = steps.find((s) => s.type === "take");
    const txn = await takeStep!.take();
  });
});
