import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

import { expect } from "chai";
import { parseEther, parseUnits } from "ethers";
import { ethers } from "hardhat";

import { ItemType, MAX_INT, ADDRESS_ZERO, BYTES_ZERO } from "../src/constants";

import { describeWithFixture } from "./utils/setup";
import { MarketOffer } from "../src/types";

const MONTH_SECONDS = 30 * 24 * 60 * 60;

describeWithFixture("take a ask offer", (fixture) => {
  let amount: bigint;
  let tokenId: bigint | number;
  
  let offer: MarketOffer;
  let signature: string;

  beforeEach(async () => {
    const { signer, recipient, kettle, testErc721, testErc20 } = fixture;

    tokenId = 1;

    amount = parseUnits("10000", 6);
    await testErc20.mint(signer, amount);
    await testErc721.mint(signer, tokenId);

    const steps = await kettle.createAskOffer({
      collection: await testErc721.getAddress(),
      criteria: 0,
      itemType: 0,
      identifier: 1,
      size: 1,
      currency: await testErc20.getAddress(),
      amount,
      fee: parseUnits("0.1", 4),
      recipient: await recipient.getAddress(),
      expiration: await time.latest() + MONTH_SECONDS,
    });

    const approvals = steps.filter((s) => s.type === "approval");
    for (const step of approvals) {
      await step.transact();
    }

    const createStep = steps.find((s) => s.type === "create");
    ({ offer, signature } = await createStep!.create());
  })

  it("should take a ask offer", async () => {
    const { taker, kettle, testErc721, testErc20, testErc1155 } = fixture;

    await testErc20.mint(taker, amount);

    const steps = await kettle.connect(taker).takeAskOffer(
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
