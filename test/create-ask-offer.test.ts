import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

import { expect } from "chai";
import { parseEther, parseUnits } from "ethers";
import { ethers } from "hardhat";

import { ItemType, MAX_INT, ADDRESS_ZERO, BYTES_ZERO } from "../src/constants";

import { describeWithFixture } from "./utils/setup";

const MONTH_SECONDS = 30 * 24 * 60 * 60;

describeWithFixture("create a ask offer", (fixture) => {
  it("should create a ask offer", async () => {
    const { signer, kettle, testErc721, testErc20, testErc1155 } = fixture;

    const principal = parseUnits("10000", 6);

    await testErc20.mint(signer, principal);
    await testErc721.mint(signer, 1);

    const steps = await kettle.createAskOffer({
      collection: await testErc721.getAddress(),
      criteria: 0,
      itemType: 0,
      identifier: 1,
      size: 1,
      currency: await testErc20.getAddress(),
      amount: principal,
      fee: parseUnits("0.1", 4),
      recipient: ADDRESS_ZERO,
      expiration: await time.latest() + MONTH_SECONDS,
    });

    const approvals = steps.filter((s) => s.type === "approval");
    for (const step of approvals) {
      await step.transact();
    }

    const createStep = steps.find((s) => s.type === "create");
    const { type, offer, signature } = await createStep!.create();
    // console.log({ type, offer, signature })
  });
});
