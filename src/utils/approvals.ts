import { Signer, ethers } from "ethers";

import { TestERC721__factory, TestERC20__factory } from "../typechain-types";
import { Collateral, CurrencyTerms, ItemType } from "../types";
import { isErc1155Item, isErc721Item } from "./item";
import { MAX_INT } from "../constants";

import type { ApprovalAction } from "../types";

export type BalancesAndApprovals = {
  token: string;
  identifierOrCriteria: string;
  balance: bigint;
  approvedAmount: bigint;
  itemType: ItemType;
};

export type InsufficientApprovals = {
  token: string;
  operator: string;
  itemType: ItemType;
}

export const collateralApprovedForAll = async (
  owner: string,
  collateral: Collateral,
  operator: string,
  provider: ethers.Provider,
) => {
  const contract = TestERC721__factory.connect(collateral.collection, provider);
  return await contract.isApprovedForAll(owner, operator);
}

export const currencyAllowance = async (
  owner: string,
  currency: string,
  spender: string,
  provider: ethers.Provider,
) => {
  const contract = TestERC20__factory.connect(currency, provider);
  return await contract.allowance(owner, spender);
}

export async function getApprovalAction(
  token: string,
  operator: string,
  signer: Signer
): Promise<ApprovalAction> {
  const contract = TestERC721__factory.connect(token, signer);
  const transactionMethod = await contract.setApprovalForAll.populateTransaction(operator, true);

  return {
    type: "approval",
    approve: async () => {
      return await signer.sendTransaction(transactionMethod)
    }
  }
}

export async function getAllowanceAction(
  currency: string,
  spender: string,
  signer: Signer
): Promise<ApprovalAction> {
    const contract = TestERC20__factory.connect(currency, signer);
    const transactionMethod = await contract.approve.populateTransaction(spender, MAX_INT);

  return {
    type: "approval",
    approve: async () => {
      return await signer.sendTransaction(transactionMethod)
    }
  }
}
