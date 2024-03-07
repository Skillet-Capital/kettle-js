import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

import { expect } from "chai";
import { parseEther, parseUnits } from "ethers";
import { ethers } from "hardhat";

import { ItemType, MAX_INT, ADDRESS_ZERO } from "../src/constants";

import { describeWithFixture } from "./utils/setup";
import { ApprovalAction, CreateOrderAction } from "../src/types";

const MONTH_SECONDS = 30 * 24 * 60 * 60;

describeWithFixture("create a loan offer", (fixture) => {
  it("should create a loan offer", async () => {
    const { signer, kettle, testErc721, testErc20, testErc1155 } = fixture;

    const principal = parseUnits("10000", 6);

    await testErc20.mint(signer, principal);

    const steps = await kettle.createLoanOffer({
      collection: await testErc721.getAddress(),
      criteria: 0,
      itemType: 0,
      identifier: 1,
      size: 1,
      currency: await testErc20.getAddress(),
      totalAmount: principal,
      maxAmount: principal,
      minAmount: principal,
      rate: parseUnits("0.1", 4),
      defaultRate: parseUnits("0.1", 4),
      fee: parseUnits("0.1", 4),
      recipient: ADDRESS_ZERO,
      period: MONTH_SECONDS,
      gracePeriod: MONTH_SECONDS,
      installments: 12,
      expiration: await time.latest() + MONTH_SECONDS,
    });

    const approvals = steps.filter((s) => s.type === "approval") as ApprovalAction[];
    for (const step of approvals) {
      await step.approve();
    }

    const createStep = steps.find((s) => s.type === "create") as CreateOrderAction;
    const { type, offer, signature } = await createStep!.createOrder();
  });
})