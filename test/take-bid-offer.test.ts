import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

import { expect } from "chai";
import { parseUnits } from "ethers";

import { ItemType } from "../src/constants";
import { ApprovalAction, CreateOrderAction, TakeOrderAction } from "../src/types";

import { describeWithFixture } from "./utils/setup";
import type { MarketOffer } from "../src/types";

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

    const steps = await kettle.createBidOffer({
      collection: await testErc721.getAddress(),
      itemType: ItemType.ERC721,
      identifier: 1,
      currency: await testErc20.getAddress(),
      amount,
      fee: parseUnits("0.1", 4),
      recipient: await recipient.getAddress(),
      expiration: await time.latest() + MONTH_SECONDS,
    });

    const approvals = steps.filter((s) => s.type === "approval") as ApprovalAction[];
    for (const step of approvals) {
      await step.approve();
    }

    const createStep = steps.find((s) => s.type === "create") as CreateOrderAction;
    const create = await createStep!.createOrder();

    offer = create.offer as MarketOffer;
    signature = create.signature;
  });

  it("should take a bid offer", async () => {
    const { taker, kettle, testErc721, testErc20, testErc1155 } = fixture;

    await testErc721.mint(taker, tokenId);

    const steps = await kettle.connect(taker).takeBidOffer(
      offer,
      signature
    );

    const approvals = steps.filter((s) => s.type === "approval") as ApprovalAction[];
    for (const step of approvals) {
      await step.approve();
    }

    const takeStep = steps.find((s) => s.type === "take") as TakeOrderAction;
    const txn = await takeStep.takeOrder();
  });

  it("should fail if buyer does not have adequate balance", async () => {
    const { signer, taker, kettle, testErc721, testErc20, testErc1155 } = fixture;

    await testErc20.connect(signer).transfer(taker, amount);

    await expect(kettle.connect(taker).takeBidOffer(
      offer,
      signature
    )).to.be.rejectedWith("Insufficient buyer balance");
  });

  it("should fail if buyer does not have approvals on collateral", async () => {
    const { signer, taker, kettle, kettleContract, testErc721, testErc20, testErc1155 } = fixture;

    await testErc20.connect(signer).approve(kettleContract, 0);

    await expect(kettle.connect(taker).takeBidOffer(
      offer,
      signature
    )).to.be.rejectedWith("Insufficient buyer allowance");
  });

  it("should fail if seller does not own collateral", async () => {
    const { signer, taker, kettle, testErc721, testErc20, testErc1155 } = fixture;

    await expect(kettle.connect(taker).takeBidOffer(
      offer,
      signature
    )).to.be.rejectedWith("Seller does not own collateral");
  })
});
