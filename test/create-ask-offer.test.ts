import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

import { expect } from "chai";
import { parseEther, parseUnits } from "ethers";
import { ethers } from "hardhat";

import { LoanOffer, MarketOffer, OfferType } from "../src/types";
import { ItemType, MAX_INT, ADDRESS_ZERO, BYTES_ZERO } from "../src/constants";

import { describeWithFixture } from "./utils/setup";
import { ApprovalAction, CreateOrderAction } from "../src/types";

const MONTH_SECONDS = 30 * 24 * 60 * 60;

describeWithFixture("create a ask offer", (fixture) => {
  it("should create a ask offer", async () => {
    const { signer, taker, kettle, testErc721, testErc20, testErc1155 } = fixture;

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

    const approvals = steps.filter((s) => s.type === "approval") as ApprovalAction[];
    for (const step of approvals) {
      await step.approve();
    }

    const createStep = steps.find((s) => s.type === "create") as CreateOrderAction;
    const create = await createStep!.createOrder();

    expect(create.type).to.equal(OfferType.MARKET_OFFER);
    const offer = create.offer as MarketOffer;
    const signature = create.signature;

    expect(await kettle.validateMarketOfferSignature(offer.maker, offer, signature)).to.be.true;
    expect(await kettle.validateMarketOfferSignature(await taker.getAddress(), offer, signature)).to.be.false;
  });
});
