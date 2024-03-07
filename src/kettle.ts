import {
  BigNumberish,
  ethers,
  Overrides,
  TypedDataEncoder,
  JsonRpcProvider,
  Provider,
  JsonRpcSigner,
  Signer,
} from "ethers";

import {
  KETTLE_CONTRACT_NAME,
  KETTLE_CONTRACT_VERSION,
  LOAN_OFFER_TYPE,
  MARKET_OFFER_TYPE,
  BASIS_POINTS_DIVISOR,
  BYTES_ZERO,
  ADDRESS_ZERO
} from "./constants";

import {
  Side,
  OfferType,
} from "./types";

import type {
  Collateral,
  FeeTerms,
  LoanOfferTerms,
  LoanOffer,
  MarketOfferTerms,
  MarketOffer,
  CreateLoanOfferInput,
  CreateMarketOfferInput,
  KettleContract ,
  CreateOrderAction,
  ApprovalAction,
  OrderWithSignatureAndType,
  TakeOrderAction,
} from "./types";

import {
  Kettle__factory,
} from "./typechain-types";

import {
  getApprovalAction,
  getAllowanceAction,
  currencyAllowance,
  collateralApprovedForAll
} from "./utils/approvals";

import {
  currencyBalance,
  collateralBalance
} from "./utils/balances";

import {
  generateRandomSalt
} from "./utils/order";

export class Kettle {

  public contract: KettleContract;
  public contractAddress: string;

  private provider: Provider;

  private signer?: Signer;

  public constructor(
    providerOrSigner: JsonRpcProvider | Signer,
    contractAddress: string,
  ) {
    const provider = 
      "provider" in providerOrSigner
        ? providerOrSigner.provider
        : providerOrSigner;

    this.signer = 
      "getAddress" in providerOrSigner
        ? (providerOrSigner as Signer)
        : undefined;
    
    if (!provider) {
      throw new Error(
        "Either a provider or custom signer with provider must be provided",
      );
    }

    this.provider = provider;

    this.contractAddress = contractAddress;
    this.contract = Kettle__factory.connect(
      contractAddress, 
      this.provider
    );
  }

  public connect(signer: Signer) {
    return new Kettle(signer, this.contractAddress);
  }

  public async createLoanOffer(
    input: CreateLoanOfferInput
  ): Promise<(ApprovalAction | CreateOrderAction)[]>
  {
    const signer = this.signer;
    const offerer = await signer!.getAddress();
    const operator = await this.contract.getAddress();

    const offer = this._formatLoanOffer(offerer!, input);

    const balance = await currencyBalance(
      offerer,
      offer.terms.currency,
      offer.terms.totalAmount,
      this.provider
    );

    if (!balance) {
      throw new Error("Insufficient balance")
    }

    const allowance = await currencyAllowance(
      offerer,
      offer.terms.currency,
      operator,
      this.provider
    );

    const approvalActions = [];
    if (allowance < BigInt(offer.terms.totalAmount)) {
      const allowanceAction = await getAllowanceAction(
          offer.terms.currency,
          operator,
          signer!
        )
      approvalActions.push(allowanceAction);
    }

    const createOfferAction = {
      type: "create",
      createOrder: async (): Promise<OrderWithSignatureAndType> => {
        const signature = await this.signLoanOffer(offer);

        return {
          type: OfferType.LOAN_OFFER,
          offer,
          signature
        }
      }
    } as const;

    return [...approvalActions, createOfferAction];
  }

  public async createAskOffer(
    input: CreateMarketOfferInput
  ): Promise<(ApprovalAction | CreateOrderAction)[]>{
    const signer = this.signer;
    const offerer = await signer!.getAddress();
    const operator = await this.contract.getAddress();

    const offer = this._formatMarketOffer(Side.ASK, offerer!, input);

    const balance = await collateralBalance(
      offerer,
      offer.collateral,
      this.provider
    );

    if (!balance) {
      throw new Error("Insufficient balance")
    }

    const approvalActions = [];

    const approvals = await collateralApprovedForAll(
      offerer,
      offer.collateral,
      operator,
      this.provider
    );

    if (!approvals) {
      const approvalAction = await getApprovalAction(
          offer.collateral.collection,
          operator,
          signer!
        )
      approvalActions.push(approvalAction);
    }

    const allowance = await currencyAllowance(
      offerer,
      offer.terms.currency,
      operator,
      this.provider
    );

    const marketFee = this.calculateMarketFee(
      BigInt(offer.terms.amount),
      BigInt(offer.fee.rate)
    );

    if (allowance < marketFee) {
      const allowanceAction = await getAllowanceAction(
          offer.terms.currency,
          operator,
          signer!
        )
      approvalActions.push(allowanceAction);
    }

    const createOfferAction = {
      type: "create",
      createOrder: async (): Promise<OrderWithSignatureAndType> => {
        const signature = await this.signMarketOffer(offer);

        return {
          type: OfferType.MARKET_OFFER,
          offer,
          signature
        }
      }
    } as const;

    return [...approvalActions, createOfferAction];
  }

  public async createBidOffer(
    input: CreateMarketOfferInput
  ): Promise<(ApprovalAction | CreateOrderAction)[]>{
    const signer = this.signer;
    const offerer = await signer!.getAddress();
    const operator = await this.contract.getAddress();

    const offer = this._formatMarketOffer(Side.BID, offerer!, input);

    const balance = await currencyBalance(
      offerer,
      offer.terms.currency,
      offer.terms.amount,
      this.provider
    );

    if (!balance) {
      throw new Error("Insufficient balance")
    }

    const approvalActions = [];

    const allowance = await currencyAllowance(
      offerer,
      offer.terms.currency,
      operator,
      this.provider
    );

    if (allowance < BigInt(offer.terms.amount)) {
      const allowanceAction = await getAllowanceAction(
          offer.terms.currency,
          operator,
          signer!
        )
      approvalActions.push(allowanceAction);
    }

    const createOfferAction = {
      type: "create",
      createOrder: async (): Promise<OrderWithSignatureAndType> => {
        const signature = await this.signMarketOffer(offer);

        return {
          type: OfferType.MARKET_OFFER,
          offer,
          signature
        }
      }
    } as const;

    return [...approvalActions, createOfferAction];
  }

  public async takeLoanOffer(
    offer: LoanOffer, 
    signature: string
  ): Promise<(ApprovalAction | TakeOrderAction)[]> {
    const signer = this.signer;
    const taker = await signer!.getAddress();
    const operator = await this.contract.getAddress();

    const balance = await collateralBalance(
      taker,
      offer.collateral,
      this.provider
    );

    if (!balance) {
      throw new Error("Insufficient balance")
    }

    const approvals = await collateralApprovedForAll(
      taker,
      offer.collateral,
      operator,
      this.provider
    );

    const approvalActions = [];
    if (!approvals) {
      const approvalAction = await getApprovalAction(
        offer.collateral.collection,
        operator,
        signer!
      )
      approvalActions.push(approvalAction);
    }

    const takeOfferAction = {
      type: "take",
      takeOrder: () => {
        return this.contract.connect(signer).borrow(
          offer,
          offer.terms.maxAmount,
          offer.collateral.identifier,
          ADDRESS_ZERO,
          signature,
          []
        )
      }
    } as const;

    return [...approvalActions, takeOfferAction];
  }

  public async takeAskOffer(
    offer: MarketOffer, 
    signature: string
  ): Promise<(ApprovalAction | TakeOrderAction)[]> {
    const signer = this.signer;
    const taker = await signer!.getAddress();
    const operator = await this.contract.getAddress();

    const balance = await currencyBalance(
      taker,
      offer.terms.currency,
      offer.terms.amount,
      this.provider
    );

    if (!balance) {
      throw new Error("Insufficient balance")
    }

    const allowance = await currencyAllowance(
      taker,
      offer.terms.currency,
      operator,
      this.provider
    );

    const approvalActions = [];
    if (allowance < BigInt(offer.terms.amount)) {
      const allowanceAction = await getAllowanceAction(
          offer.terms.currency,
          operator,
          signer!
        )
      approvalActions.push(allowanceAction);
    }

    const takeOfferAction = {
      type: "take",
      takeOrder: async () => {
        return await this.contract.connect(signer).marketOrder(
          offer.collateral.identifier,
          offer,
          signature,
          []
        )
      }
    } as const;

    return [...approvalActions, takeOfferAction];
  }

  private _formatLoanOffer(
    offerer: string,
    {
      collection,
      criteria,
      itemType,
      identifier,
      size,
      currency,
      totalAmount,
      maxAmount,
      minAmount,
      rate,
      defaultRate,
      fee,
      recipient,
      period,
      gracePeriod,
      installments,
      expiration
    }: CreateLoanOfferInput,
  ): LoanOffer {

    const collateral: Collateral = {
      collection,
      criteria,
      itemType,
      identifier,
      size,
    };

    const terms: LoanOfferTerms = {
      currency,
      totalAmount,
      maxAmount,
      minAmount,
      rate,
      defaultRate,
      period,
      gracePeriod,
      installments,
    };

    const feeTerms: FeeTerms = {
      recipient,
      rate: fee,
    };

    const salt = generateRandomSalt();

    return {
      lender: offerer,
      collateral,
      terms,
      fee: feeTerms,
      expiration,
      salt
    };
  }

  private _formatMarketOffer(
    side: Side,
    offerer: string,
    {
      collection,
      criteria,
      itemType,
      identifier,
      size,
      currency,
      amount,
      withLoan,
      borrowAmount,
      loanOfferHash,
      fee,
      recipient,
      expiration
    }: CreateMarketOfferInput,
  ): MarketOffer {
    const collateral: Collateral = {
      collection,
      criteria,
      itemType,
      identifier,
      size,
    };

    const terms: MarketOfferTerms = {
      currency,
      amount,
      withLoan: (side === Side.BID) ? (withLoan ?? false) : false,
      borrowAmount: (side === Side.BID) ? (borrowAmount ?? 0) : 0,
      loanOfferHash: (side === Side.BID) ? (loanOfferHash ?? BYTES_ZERO) : BYTES_ZERO
    };

    const feeTerms: FeeTerms = {
      recipient,
      rate: fee
    };

    const salt = generateRandomSalt();

    return {
      side,
      maker: offerer,
      collateral,
      terms,
      fee: feeTerms,
      expiration,
      salt
    };
  }

  private async _getDomainData() {
    const { chainId } = await this.provider.getNetwork();

    return {
      name: KETTLE_CONTRACT_NAME,
      version: KETTLE_CONTRACT_VERSION,
      chainId,
      verifyingContract: await this.contract.getAddress()
    }
  }

  public async signLoanOffer(offer: LoanOffer) {
    const domain = await this._getDomainData();

    return this.signer!.signTypedData(
      domain, 
      LOAN_OFFER_TYPE, 
      {
        ...offer,
        nonce: await this.contract.nonces(offer.lender)
      }
    );
  }

  public async signMarketOffer(offer: MarketOffer) {
    const domain = await this._getDomainData();

    return this.signer!.signTypedData(
      domain, 
      MARKET_OFFER_TYPE, 
      {
        ...offer,
        nonce: await this.contract.nonces(offer.maker)
      }
    );
  }

  public calculateMarketFee(
    amount: bigint,
    rate: bigint
  ) {
    return (amount * rate) / BigInt(BASIS_POINTS_DIVISOR);
  }
}
