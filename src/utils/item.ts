import { ItemType } from "../constants";
import type { Collateral } from "../types";

export const isErc721Item = (itemType: Collateral["itemType"]) =>
  ItemType.ERC721 === itemType;

export const isErc1155Item = (itemType: Collateral["itemType"]) =>
  ItemType.ERC1155 === itemType;
