import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

import { expect } from "chai";
import { parseEther, parseUnits } from "ethers";
import { ethers } from "hardhat";

import { ItemType, MAX_INT, ADDRESS_ZERO, BYTES_ZERO } from "../src/constants";

import { describeWithFixture } from "./utils/setup";
import { ApprovalAction, CreateOrderAction, LoanOffer, TakeOrderAction } from "../src/types";

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
      duration: MONTH_SECONDS,
      gracePeriod: MONTH_SECONDS,
      expiration: await time.latest() + MONTH_SECONDS,
    });

    const approvals = steps.filter((s) => s.type === "approval") as ApprovalAction[];
    for (const step of approvals) {
      await step.approve();
    }

    const createStep = steps.find((s) => s.type === "create") as CreateOrderAction;
    const create = await createStep!.createOrder();

    offer = create.offer as LoanOffer;
    signature = create.signature;
  })

  it("should take a loan offer", async () => {
    const { taker, kettle, testErc721, testErc20, testErc1155 } = fixture;

    await testErc721.mint(taker, tokenId);

    const steps = await kettle.connect(taker).takeLoanOffer(
      offer,
      signature
    );

    const approvals = steps.filter((s) => s.type === "approval") as ApprovalAction[];
    for (const step of approvals) {
      await step.approve();
    }

    const takeStep = steps.find((s) => s.type === "take") as TakeOrderAction;
    const txn = await takeStep!.takeOrder();
  });

  it("should fail if borrower does not own asset", async () => {
    const { taker, kettle, testErc721, testErc20, testErc1155 } = fixture;

    await expect(kettle.connect(taker).takeLoanOffer(
      offer,
      signature
    )).to.be.rejectedWith("Borrower does not own collateral");
  
  })

  it("should fail if lender does not have adequate balance", async () => {
    const { signer, taker, kettle, testErc721, testErc20, testErc1155 } = fixture;

    await testErc20.connect(signer).transfer(taker, principal);

    await expect(kettle.connect(taker).takeLoanOffer(
      offer,
      signature
    )).to.be.rejectedWith("Insufficient lender balance");
  });

  it("should fail if lender does not have adequate allowance", async () => {
    const { signer, taker, kettle, kettleContract, testErc721, testErc20, testErc1155 } = fixture;

    await testErc20.connect(signer).approve(kettleContract, 0);

    await expect(kettle.connect(taker).takeLoanOffer(
      offer,
      signature
    )).to.be.rejectedWith("Insufficient lender allowance");
  });
});
