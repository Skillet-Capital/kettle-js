import { ethers } from "ethers";
import { Kettle as KettleContract } from "./typechain-types/kettle_v3/contracts/Kettle";

export type { KettleContract }

export enum OfferType {
  LOAN_OFFER,
  BORROWER_OFFER,
  MARKET_OFFER
}

export enum LienStatus {
  CURRENT,
  DELINQUENT,
  DEFAULTED
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
  duration: string | number | bigint;
  gracePeriod: string | number | bigint;
}

export type LoanOffer = {
  lender: string;
  collateral: Collateral;
  terms: LoanOfferTerms;
  fee: FeeTerms;
  expiration: string | number | bigint;
  salt: string | number | bigint;
  nonce: string | number | bigint;
}

export type LoanOfferWithHash = {
  hash: string;
  lender: string;
  collateral: Collateral;
  terms: LoanOfferTerms;
  fee: FeeTerms;
  expiration: string | number | bigint;
  salt: string | number | bigint;
  nonce: string | number | bigint;
}

export type BorrowOfferTerms = {
  currency: string;
  amount: string | number | bigint;
  rate: string | number | bigint;
  defaultRate: string | number | bigint;
  duration: string | number | bigint;
  gracePeriod: string | number | bigint;
}

export type BorrowOffer = {
  borrower: string;
  collateral: Collateral;
  terms: BorrowOfferTerms;
  fee: FeeTerms;
  expiration: string | number | bigint;
  salt: string | number | bigint;
  nonce: string | number | bigint;
}

export type BorrowOfferWithHash = {
  hash: string;
  borrower: string;
  collateral: Collateral;
  terms: BorrowOfferTerms;
  fee: FeeTerms;
  expiration: string | number | bigint;
  salt: string | number | bigint;
  nonce: string | number | bigint;
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
  nonce: string | number | bigint;
}

export type MarketOfferWithHash = {
  hash: string;
  side: Side;
  maker: string;
  collateral: Collateral;
  terms: MarketOfferTerms;
  fee: FeeTerms;
  expiration: string | number | bigint;
  salt: string | number | bigint;
  nonce: string | number | bigint;
}

export type LienState = {
  installment: string | number | bigint;
  principal: string | number | bigint;
}

export type Lien = {
  recipient: string;
  borrower: string;
  currency: string;
  collection: string;
  itemType: ItemType;
  tokenId: string | number | bigint;
  size: string | number | bigint;
  principal: string | number | bigint;
  rate: string | number | bigint;
  defaultRate: string | number | bigint;
  fee: string | number | bigint;
  duration: string | number | bigint;
  gracePeriod: string | number | bigint;
  startTime: string | number | bigint;
}

export type LienWithLender = {
  recipient: string;
  lender: string;
  borrower: string;
  currency: string;
  collection: string;
  itemType: ItemType;
  tokenId: string | number | bigint;
  size: string | number | bigint;
  principal: string | number | bigint;
  rate: string | number | bigint;
  defaultRate: string | number | bigint;
  fee: string | number | bigint;
  duration: string | number | bigint;
  gracePeriod: string | number | bigint;
  startTime: string | number | bigint;
}

export type CreateLoanOfferInput = {
  collection: string;
  itemType: ItemType;
  identifier: string | number | bigint;
  currency: string;
  amount: string | number | bigint;
  rate: string | number | bigint;
  defaultRate: string | number | bigint;
  fee: string | number | bigint;
  recipient: string;
  duration: string | number | bigint;
  gracePeriod: string | number | bigint;
  expiration: string | number | bigint;
  lien?: LienWithLender;
}

export type CreateBorrowOfferInput = {
  collection: string;
  itemType: ItemType;
  identifier: string | number | bigint;
  currency: string;
  amount: string | number | bigint;
  rate: string | number | bigint;
  defaultRate: string | number | bigint;
  fee: string | number | bigint;
  recipient: string;
  duration: string | number | bigint;
  gracePeriod: string | number | bigint;
  expiration: string | number | bigint;
}

export type CreateMarketOfferInput = {
  collection: string;
  itemType: ItemType;
  identifier: string | number | bigint;
  criteria?: Criteria;
  currency: string;
  amount: string | number | bigint;
  withLoan?: boolean;
  borrowAmount?: string | number | bigint;
  loanOfferHash?: string;
  fee: string | number | bigint;
  recipient: string;
  expiration: string | number | bigint;
  lien?: LienWithLender;
}

export type Payment = {
  periodStart: string | number | bigint;
  deadline: string | number | bigint;
  principal: string | number | bigint;
  interest: string | number | bigint;
  fee: string | number | bigint;
}

export type PaymentState = {
  status: bigint;
  balance: string | number | bigint;
  delinquent: Payment | null;
  current: Payment | null;
}

export type RepaymentState = {
  balance: bigint | number | string;
  principal: bigint | number | string;
  interest: bigint | number | string;
  fee: bigint | number | string; 
}

export type OrderWithSignatureAndType = {
  type: OfferType;
  offer: LoanOffer | BorrowOffer | MarketOffer;
  signature: string;
}

export type CreateOrderAction = {
  type: "create";
  offerType: OfferType;
  offer: LoanOffer | BorrowOffer | MarketOffer;
  payload: any;
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

export type RepayAction = {
  type: "repay";
  repay: () => Promise<ethers.TransactionResponse>;
}

export type ClaimAction = {
  type: "claim";
  claim: () => Promise<ethers.TransactionResponse>;
}

export type CancelOrderAction = {
  type: "cancel";
  cancelOrder: () => Promise<ethers.ContractTransactionReceipt | null>;
}

export type CancelOrdersAction = {
  type: "cancel";
  cancelOrders: () => Promise<ethers.TransactionResponse>;
}

export type IncrementNonceAction = {
  type: "incrementNonce";
  incrementNonce: () => Promise<ethers.TransactionResponse>;
}
