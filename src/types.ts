import { ethers } from "ethers";
import { Kettle as KettleContract } from "./typechain-types/kettle_v3/contracts/Kettle";

export type { KettleContract }

export enum OfferType {
  LOAN_OFFER,
  BORROWER_OFFER,
  MARKET_OFFER
}

export enum Criteria { SIMPLE, PROOF }
export enum Side { BID, ASK }
export enum ItemType { ERC721, ERC1155 }

export type CurrencyTerms = {
  currency: string;
  amount: string | number | bigint;
}

export type Collateral = {
  collection: string;
  criteria: Criteria;
  itemType: ItemType;
  identifier: string | number | bigint;
  size: string | number | bigint;
}

export type FeeTerms = {
  recipient: string;
  rate: string | number | bigint;
}

export type LoanOfferTerms = {
  currency: string;
  totalAmount: string | number | bigint;
  maxAmount: string | number | bigint;
  minAmount: string | number | bigint;
  rate: string | number | bigint;
  defaultRate: string | number | bigint;
  period: string | number | bigint;
  gracePeriod: string | number | bigint;
  installments: string | number | bigint;
}

export type LoanOffer = {
  lender: string;
  collateral: Collateral;
  terms: LoanOfferTerms;
  fee: FeeTerms;
  expiration: string | number | bigint;
  salt: string | number | bigint;
}

export type MarketOfferTerms = {
  currency: string;
  amount: string | number | bigint;
  withLoan: boolean;
  borrowAmount: string | number | bigint;
  loanOfferHash: string;
}

export type MarketOffer = {
  side: Side;
  maker: string;
  collateral: Collateral;
  terms: MarketOfferTerms;
  fee: FeeTerms;
  expiration: string | number | bigint;
  salt: string | number | bigint;
}

export type CreateLoanOfferInput = {
  collection: string;
  criteria: Criteria;
  itemType: ItemType;
  identifier: string | number | bigint;
  size: string | number | bigint;
  currency: string;
  totalAmount: string | number | bigint;
  maxAmount: string | number | bigint;
  minAmount: string | number | bigint;
  rate: string | number | bigint;
  defaultRate: string | number | bigint;
  fee: string | number | bigint;
  recipient: string;
  period: string | number | bigint;
  gracePeriod: string | number | bigint;
  installments: string | number | bigint;
  expiration: string | number | bigint;
}

export type CreateMarketOfferInput = {
  collection: string;
  criteria: Criteria;
  itemType: ItemType;
  identifier: string | number | bigint;
  size: string | number | bigint;
  currency: string;
  amount: string | number | bigint;
  withLoan?: boolean;
  borrowAmount?: string | number | bigint;
  loanOfferHash?: string;
  fee: string | number | bigint;
  recipient: string;
  expiration: string | number | bigint;
}

export type OrderWithSignatureAndType = {
  type: OfferType;
  offer: LoanOffer | MarketOffer;
  signature: string;
}

export type CreateOrderAction = {
  type: "create";
  createOrder: () => Promise<OrderWithSignatureAndType>;
}

export type ApprovalAction = {
  type: "approval";
  approve: () => Promise<ethers.TransactionResponse>;
}

export type TakeOrderAction = {
  type: "take";
  takeOrder: () => Promise<ethers.TransactionResponse>;
}

export type CancelOrderAction = {
  type: "cancel";
  cancelOrder: () => Promise<ethers.TransactionResponse>;
}
