import { ethers } from "hardhat";
import { Kettle } from "../../src/kettle";

import type {
  TestERC721,
  TestERC20,
  TestERC1155,
  Kettle as KettleContract,
} from "../../src/typechain-types";
import { Signer } from "ethers";

const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
const sinonChai = require("sinon-chai");

chai.use(chaiAsPromised);
chai.use(sinonChai);

type Fixture = {
  signer: Signer,
  taker: Signer,
  recipient: Signer,
  kettleContract: KettleContract;
  kettle: Kettle;
  testErc721: TestERC721;
  testErc20: TestERC20;
  testErc1155: TestERC1155;
};

export const describeWithFixture = (
  name: string,
  suiteCb: (fixture: Fixture) => unknown,
) => {
  describe(name, () => {
    const fixture: Partial<Fixture> = {};

    beforeEach(async () => {
      const [signer, taker, recipient] = await ethers.getSigners();

      const CompoundInterest = await ethers.getContractFactory(
        "kettle_v3/contracts/models/CompoundInterest.sol:CompoundInterest"
      );
      const compoundInterest = await CompoundInterest.deploy();

      const Distributions = await ethers.getContractFactory(
        "kettle_v3/contracts/lib/Distributions.sol:Distributions"
      );
      const distributions = await Distributions.deploy();

      const KettleFactory = await ethers.getContractFactory(
        "kettle_v3/contracts/Kettle.sol:Kettle",
        {
          libraries: {
            CompoundInterest: compoundInterest.target,
            Distributions: distributions.target,
          },
        }
      );

      const LenderReceiptFactory = await ethers.getContractFactory(
        "kettle_v3/contracts/LenderReceipt.sol:LenderReceipt",
      );
      const lenderReceipt = await LenderReceiptFactory.deploy();

      const kettleContract = await KettleFactory.deploy(lenderReceipt) as KettleContract;

      await kettleContract.waitForDeployment();

      await lenderReceipt.setSupplier(kettleContract, 1);

      const kettle = new Kettle(
        signer as Signer,
        await kettleContract.getAddress(),
      );

      const TestERC721 = await ethers.getContractFactory("TestERC721") as TestERC721;
      const testErc721 = await TestERC721.deploy();
      await testErc721.waitForDeployment();

      const TestERC1155 = await ethers.getContractFactory("TestERC1155") as TestERC1155;
      const testErc1155 = await TestERC1155.deploy();
      await testErc1155.waitForDeployment();

      const TestERC20 = await ethers.getContractFactory("TestERC20") as TestERC20;
      const testErc20 = await TestERC20.deploy();
      await testErc20.waitForDeployment();

      // In order for cb to get the correct fixture values we have
      // to pass a reference to an object that you we mutate.
      fixture.signer = signer;
      fixture.taker = taker;
      fixture.recipient = recipient;
      fixture.kettleContract = kettleContract;
      fixture.kettle = kettle;
      fixture.testErc721 = testErc721;
      fixture.testErc1155 = testErc1155;
      fixture.testErc20 = testErc20;
    });

    suiteCb(fixture as Fixture);
  });
};
