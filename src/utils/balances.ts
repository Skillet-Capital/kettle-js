import { ethers } from "ethers";
import { ItemType } from "../constants";
import {
  TestERC721__factory,
  TestERC1155__factory,
  TestERC20__factory,
} from "../typechain-types";
import { Collateral } from "../types";
import { isErc721Item } from "./item";

export const collateralBalance = async (
  owner: string,
  collateral: Collateral,
  provider: ethers.Provider,
) => {
  if (isErc721Item(collateral.itemType)) {
    const contract = TestERC721__factory.connect(collateral.collection, provider);
    try {
      const _owner = await contract.ownerOf(collateral.identifier);
      return _owner === owner;
    } catch {
      return false;
    }
  } else {
    const contract = TestERC1155__factory.connect(collateral.collection, provider);
    try {
      const balance = await contract.balanceOf(owner, collateral.identifier);
      return balance >= BigInt(collateral.size);
    } catch {
      return false;
    }
  }
}

export const currencyBalance = async (
  owner: string,
  currency: string,
  amount: string | number | bigint,
  provider: ethers.Provider,
) => {
  const contract = TestERC20__factory.connect(currency, provider);
  const balance = await contract.balanceOf(owner);
  return balance >= BigInt(amount);
}
