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
  BORROW_OFFER_TYPE,
  MARKET_OFFER_TYPE,
  BASIS_POINTS_DIVISOR,
  BYTES_ZERO,
  ADDRESS_ZERO
} from "./constants";

import {
  Side,
  OfferType,
  LienStatus,
  Criteria,
} from "./types";

import type {
  Lien,
  Payment,
  PaymentState,
  RepaymentState,
  Collateral,
  FeeTerms,
  LoanOfferTerms,
  LoanOffer,
  BorrowOfferTerms,
  BorrowOffer,
  MarketOfferTerms,
  MarketOffer,
  CreateLoanOfferInput,
  CreateBorrowOfferInput,
  CreateMarketOfferInput,
  KettleContract ,
  CreateOrderAction,
  ApprovalAction,
  OrderWithSignatureAndType,
  TakeOrderAction,
  RepayAction,
  ClaimAction,
  CancelOrderAction,
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

import {
  getEpoch
} from "./utils/time";

import {
  equalAddresses
} from "./utils/equalAddresses";

export class Kettle {

  public contract: KettleContract;
  public contractAddress: string;

  private provider: Provider;

  private signer?: Signer;

  public constructor(
    providerOrSigner: JsonRpcProvider | Signer | JsonRpcSigner,
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
    input: CreateLoanOfferInput,
    accountAddress?: string
  ): Promise<(ApprovalAction | CreateOrderAction)[]>
  {
    const signer = await this._getSigner(accountAddress);
    const offerer = accountAddress ?? (await signer.getAddress());
    const operator = await this.contract.getAddress();

    const offer = await this._formatLoanOffer(offerer!, input);

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
      offerType: OfferType.LOAN_OFFER,
      offer,
      payload: await this.getLoanOfferPayload(offer),
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

  public async createBorrowOffer(
    input: CreateBorrowOfferInput,
    accountAddress?: string
  ): Promise<(ApprovalAction | CreateOrderAction)[]>
  {
    const signer = await this._getSigner(accountAddress);
    const offerer = accountAddress ?? (await signer.getAddress());
    const operator = await this.contract.getAddress();

    const offer = await this._formatBorrowOffer(offerer!, input);

    const balance = await collateralBalance(
      offerer,
      offer.collateral,
      this.provider
    );

    if (!balance) {
      throw new Error("Insufficient collateral balance")
    }

    const approvals = await collateralApprovedForAll(
      offerer,
      offer.collateral,
      operator,
      this.provider
    );

    const approvalActions = [];
    if (!approvals) {
      const allowanceAction = await getApprovalAction(
          offer.collateral.collection,
          operator,
          signer!
        )
      approvalActions.push(allowanceAction);
    }

    const createOfferAction = {
      type: "create",
      offerType: OfferType.BORROWER_OFFER,
      offer,
      payload: await this.getBorrowOfferPayload(offer),
      createOrder: async (): Promise<OrderWithSignatureAndType> => {
        const signature = await this.signBorrowOffer(offer);

        return {
          type: OfferType.BORROWER_OFFER,
          offer,
          signature
        }
      }
    } as const;

    return [...approvalActions, createOfferAction];
  }

  public async createAskOffer(
    input: CreateMarketOfferInput,
    accountAddress?: string
  ): Promise<(ApprovalAction | CreateOrderAction)[]>{
    const signer = await this._getSigner(accountAddress);
    const offerer = accountAddress ?? (await signer.getAddress());
    const operator = await this.contract.getAddress();

    const offer = await this._formatMarketOffer(Side.ASK, offerer!, input);

    const balance = await collateralBalance(
      offerer,
      offer.collateral,
      this.provider
    );

    if (!balance) {
      throw new Error("Insufficient collateral balance")
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
      offerType: OfferType.MARKET_OFFER,
      offer,
      payload: await this.getMarketOfferPayload(offer),
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
    input: CreateMarketOfferInput,
    accountAddress?: string
  ): Promise<(ApprovalAction | CreateOrderAction)[]>{
    const signer = await this._getSigner(accountAddress);
    const offerer = accountAddress ?? (await signer.getAddress());
    const operator = await this.contract.getAddress();

    const offer = await this._formatMarketOffer(Side.BID, offerer!, input);

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
      offerType: OfferType.MARKET_OFFER,
      offer,
      payload: await this.getMarketOfferPayload(offer),
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

  // call order book (getLoanOffer) with hash to get the actual loan offer
  // - { offer, signature }
  public async takeLoanOffer(
    offer: LoanOffer, 
    signature: string,
    accountAddress?: string
  ): Promise<(ApprovalAction | TakeOrderAction)[]> {
    const signer = await this._getSigner(accountAddress);
    const taker = accountAddress ?? (await signer.getAddress());
    const operator = await this.contract.getAddress();

    await this.validateLoanOffer(offer);

    // borrower balance checks and approvals
    const balance = await collateralBalance(
      taker,
      offer.collateral,
      this.provider
    );

    if (!balance) {
      throw new Error("Borrower does not own collateral")
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

  public async refinance(
    lienId: bigint | number,
    lien: Lien,
    offer: LoanOffer,
    signature: string,
    accountAddress?: string
  ): Promise<(ApprovalAction | TakeOrderAction)[]> {
    const signer = await this._getSigner(accountAddress);
    const taker = accountAddress ?? (await signer.getAddress());
    const operator = await this.contract.getAddress();

    // validate loan offer and refinancing
    await this.validateLoanOffer(offer);
    await this.validateRefinance(taker, lien, offer);

    const { debt } = await this.contract.currentDebtAmount(lien);

    const approvalActions = [];
    if (debt > BigInt(offer.terms.maxAmount)) {
      const diff = debt - BigInt(offer.terms.maxAmount);

      const allowance = await currencyAllowance(
        taker,
        offer.terms.currency,
        operator,
        this.provider
      );
  
      if (allowance < BigInt(diff)) {
        const allowanceAction = await getAllowanceAction(
            offer.terms.currency,
            operator,
            signer!
          )
        approvalActions.push(allowanceAction);
      }
    }

    const takeOfferAction = {
      type: "take",
      takeOrder: () => {
        return this.contract.connect(signer).refinance(
          lienId,
          offer.terms.maxAmount,
          lien,
          offer,
          signature,
          []
        )
      }
    } as const;

    return [...approvalActions, takeOfferAction];
  }

  public async takeBorrowOffer(
    offer: BorrowOffer,
    signature: string,
    accountAddress?: string
  ): Promise<(ApprovalAction | TakeOrderAction)[]> {
    const signer = await this._getSigner(accountAddress);
    const taker = accountAddress ?? (await signer.getAddress());
    const operator = await this.contract.getAddress();

    await this.validateBorrowOffer(offer);

    // taker balance checks and approvals
    const balance = await currencyBalance(
      taker,
      offer.terms.currency,
      offer.terms.amount,
      this.provider
    );

    if (!balance) {
      throw new Error("Insufficient lender balance")
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
        return await this.contract.connect(signer).loan(
          offer,
          signature
        )
      }
    } as const;

    return [...approvalActions, takeOfferAction];
  }

  /**
   * When the buyer wants to buy asset from seller
   * Ask Offer is made from the seller
   * Buyer is the taker
   * @param offer 
   * @param signature 
   * @returns 
   */
  public async takeAskOffer(
    offer: MarketOffer, 
    signature: string,
    accountAddress?: string
  ): Promise<(ApprovalAction | TakeOrderAction)[]> {
    const signer = await this._getSigner(accountAddress);
    const taker = accountAddress ?? (await signer.getAddress());
    const operator = await this.contract.getAddress();

    await this.validateAskOffer(offer);
    
    const balance = await currencyBalance(
      taker,
      offer.terms.currency,
      offer.terms.amount,
      this.provider
    );

    if (!balance) {
      throw new Error("Insufficient buyer balance")
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

  public async takeAskOfferInLien(
    lienId: bigint | number,
    lien: Lien,
    offer: MarketOffer, 
    signature: string,
    accountAddress?: string
  ): Promise<(ApprovalAction | TakeOrderAction)[]> {
    const signer = await this._getSigner(accountAddress);
    const taker = accountAddress ?? (await signer.getAddress());
    const operator = await this.contract.getAddress();

    await this.validateAskOffer(offer, lien);

    const balance = await currencyBalance(
      taker,
      offer.terms.currency,
      offer.terms.amount,
      this.provider
    );

    if (!balance) {
      throw new Error("Insufficient buyer balance")
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
        return await this.contract.connect(signer).buyInLien(
          lienId,
          lien,
          offer,
          signature,
          []
        )
      }
    } as const;

    return [...approvalActions, takeOfferAction];
  }

  /**
   * The Seller wants to sell to a buyer
   * BidOffer is made from the buyer
   * Seller is the taker
   * @param offer 
   * @param signature 
   * @returns 
   */
  public async takeBidOffer(
    offer: MarketOffer, 
    signature: string,
    accountAddress?: string
  ): Promise<(ApprovalAction | TakeOrderAction)[]> {
    const signer = await this._getSigner(accountAddress);
    const taker = accountAddress ?? (await signer.getAddress());
    const operator = await this.contract.getAddress();

    await this.validateBidOffer(offer);

    const balance = await collateralBalance(
      taker,
      offer.collateral,
      this.provider
    );

    if (!balance) {
      throw new Error("Seller does not own collateral")
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

  public async takeBidOfferInLien(
    lienId: bigint | number,
    lien: Lien,
    offer: MarketOffer, 
    signature: string,
    accountAddress?: string
  ): Promise<(ApprovalAction | TakeOrderAction)[]> {
    const signer = await this._getSigner(accountAddress);
    const taker = accountAddress ?? (await signer.getAddress());
    const operator = await this.contract.getAddress();

    await this.validateBidOffer(offer);
    await this.validateSellInLien(taker, lien, offer);

    const { debt } = await this.contract.currentDebtAmount(lien);

    const approvalActions = [];
    if (debt > BigInt(offer.terms.amount)) {
      const diff = debt - BigInt(offer.terms.amount);

      const allowance = await currencyAllowance(
        taker,
        offer.terms.currency,
        operator,
        this.provider
      );
  
      if (allowance < BigInt(diff)) {
        const allowanceAction = await getAllowanceAction(
            offer.terms.currency,
            operator,
            signer!
          )
        approvalActions.push(allowanceAction);
      }
    }

    const takeOfferAction = {
      type: "take",
      takeOrder: async () => {
        return await this.contract.connect(signer).sellInLien(
          lienId,
          lien,
          offer,
          signature,
          []
        )
      }
    } as const;

    return [...approvalActions, takeOfferAction];
  }

  public async repay(
    lienId: bigint | number,
    lien: Lien,
    accountAddress?: string
  ): Promise<(ApprovalAction | RepayAction)[]>{
    const signer = await this._getSigner(accountAddress);
    const taker = accountAddress ?? (await signer.getAddress());
    const operator = await this.contract.getAddress();

    await this.validateRepay(lien);

    const allowance = await currencyAllowance(
      taker,
      lien.currency,
      operator,
      this.provider
    );

    const approvalActions = [];
    const { debt } = await this.contract.currentDebtAmount(lien);
    if (allowance < debt) {
      const allowanceAction = await getAllowanceAction(
          lien.currency,
          operator,
          signer!
        )
      approvalActions.push(allowanceAction);
    }

    const repayAction = {
      type: "repay",
      repay: async () => {
        return await this.contract.connect(signer).repay(lienId, lien)
      }
    } as const;

    return [...approvalActions, repayAction];
  }

  public async claim(
    lienId: bigint | number,
    lien: Lien,
    accountAddress?: string
  ): Promise<ClaimAction> {
    if (BigInt(lien.startTime) + BigInt(lien.duration) + BigInt(lien.gracePeriod) > getEpoch()) {
      throw new Error("Lien is not defaulted");
    }
    const signer = await this._getSigner(accountAddress);

    const claimAction = {
      type: "claim",
      claim: async () => {
        return await this.contract.connect(signer).repay(lienId, lien)
      }
    } as const;

    return claimAction;
  }

  public async cancelOffer(
    salt: string,
    accountAddress?: string
  ): Promise<CancelOrderAction> {
    const signer = await this._getSigner(accountAddress);

    return {
      type: "cancel",
      cancelOrder: () => {
        return this.contract.connect(signer).cancelOffer(salt);
      }
    }
  }

  public async currentDebtAmount(lien: Lien) {
    return this.contract.currentDebtAmount(lien);
  }

  private async _formatLoanOffer(
    offerer: string,
    {
      collection,
      itemType,
      identifier,
      currency,
      amount,
      rate,
      defaultRate,
      fee,
      recipient,
      duration,
      gracePeriod,
      expiration
    }: CreateLoanOfferInput,
  ): Promise<LoanOffer> {

    const collateral: Collateral = {
      collection,
      criteria: Criteria.SIMPLE,
      itemType,
      identifier,
      size: 1,
    };

    const terms: LoanOfferTerms = {
      currency,
      totalAmount: amount,
      maxAmount: amount,
      minAmount: amount,
      rate,
      defaultRate,
      duration,
      gracePeriod
    };

    const feeTerms: FeeTerms = {
      recipient,
      rate: fee,
    };

    const salt = generateRandomSalt();
    const nonce = await this.contract.nonces(offerer);

    return {
      lender: offerer,
      collateral,
      terms,
      fee: feeTerms,
      expiration,
      salt,
      nonce: nonce.toString()
    };
  }

  private async _formatBorrowOffer(
    offerer: string,
    {
      collection,
      itemType,
      identifier,
      currency,
      amount,
      rate,
      defaultRate,
      fee,
      recipient,
      duration,
      gracePeriod,
      expiration
    }: CreateBorrowOfferInput,
  ): Promise<BorrowOffer> {

    const collateral: Collateral = {
      collection,
      criteria: Criteria.SIMPLE,
      itemType,
      identifier,
      size: 1,
    };

    const terms: BorrowOfferTerms = {
      currency,
      amount,
      rate,
      defaultRate,
      duration,
      gracePeriod
    };

    const feeTerms: FeeTerms = {
      recipient,
      rate: fee,
    };

    const salt = generateRandomSalt();
    const nonce = await this.contract.nonces(offerer);

    return {
      borrower: offerer,
      collateral,
      terms,
      fee: feeTerms,
      expiration,
      salt,
      nonce: nonce.toString()
    };
  }

  private async _formatMarketOffer(
    side: Side,
    offerer: string,
    {
      collection,
      itemType,
      identifier,
      currency,
      amount,
      withLoan,
      borrowAmount,
      loanOfferHash,
      fee,
      recipient,
      expiration
    }: CreateMarketOfferInput,
  ): Promise<MarketOffer> {

    const collateral: Collateral = {
      collection,
      criteria: Criteria.SIMPLE,
      itemType,
      identifier,
      size: 1,
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
    const nonce = await this.contract.nonces(offerer);

    return {
      side,
      maker: offerer,
      collateral,
      terms,
      fee: feeTerms,
      expiration,
      salt,
      nonce: nonce.toString()
    };
  }

  public async validateLoanOffer(offer: LoanOffer) {
    const operator = await this.contract.getAddress();

    const lenderBalance = await currencyBalance(
      offer.lender,
      offer.terms.currency,
      offer.terms.maxAmount,
      this.provider
    );

    if (!lenderBalance) {
      throw new Error("Insufficient lender balance")
    }

    const lenderAllowance = await currencyAllowance(
      offer.lender,
      offer.terms.currency,
      operator,
      this.provider
    );

    if (lenderAllowance < BigInt(offer.terms.maxAmount)) {
      throw new Error("Insufficient lender allowance")
    }

    const _offerHash = await this.getLoanOfferHash(offer);
    const amountTaken = await this.contract.amountTaken(_offerHash);
    const remainingAmount = BigInt(offer.terms.totalAmount) - amountTaken;

    if (remainingAmount < BigInt(offer.terms.maxAmount)) {
      throw new Error("Insufficient offer amount remaining");
    }

    const cancelled = await this.contract.cancelledOrFulfilled(offer.lender, offer.salt);
    if (cancelled) {
      throw new Error("Offer has been cancelled");
    }

    const nonce = await this.contract.nonces(offer.lender);
    if (offer.nonce != nonce) {
      throw new Error("Invalid nonce");
    }
  }

  public async validateBorrowOffer(offer: BorrowOffer) {
    const operator = await this.contract.getAddress();

    const borrowerBalance = await collateralBalance(
      offer.borrower,
      offer.collateral,
      this.provider
    );

    if (!borrowerBalance) {
      throw new Error("Borrower does not own collateral")
    }

    const borrowerAllowance = await collateralApprovedForAll(
      offer.borrower,
      offer.collateral,
      operator,
      this.provider
    );

    if (!borrowerAllowance) {
      throw new Error("Borrower has not approved collateral")
    }

    const cancelled = await this.contract.cancelledOrFulfilled(offer.borrower, offer.salt);
    if (cancelled) {
      throw new Error("Offer has been cancelled");
    }

    const nonce = await this.contract.nonces(offer.borrower);
    if (offer.nonce != nonce) {
      throw new Error("Invalid nonce");
    }
  }

  public async validateAskOffer(offer: MarketOffer, lien?: Lien) {
    const operator = await this.contract.getAddress();

    const sellerBalance = await collateralBalance(
      offer.maker,
      offer.collateral,
      this.provider
    );

    if (!sellerBalance) {
      throw new Error("Seller does not own collateral")
    }

    const sellerAllowance = await collateralApprovedForAll(
      offer.maker,
      offer.collateral,
      operator,
      this.provider
    );

    // if seller does not own the collatera, the lien must own the collateral
    if (!sellerAllowance) {
      if (lien) {
        if (!equalAddresses(lien.borrower, offer.maker)) {
          throw new Error("Seller is not the borrower");
        }

        if (BigInt(lien.startTime) + BigInt(lien.duration) + BigInt(lien.gracePeriod) < getEpoch()) {
          throw new Error("Lien is defaulted");
        }

        const { debt } = await this.contract.currentDebtAmount(lien);
        if (debt > BigInt(offer.terms.amount)) {
          throw new Error("Ask does not cover debt");
        }
      }
      throw new Error("Seller has not approved collateral")
    }

    const cancelled = await this.contract.cancelledOrFulfilled(offer.maker, offer.salt);
    if (cancelled) {
      throw new Error("Offer has been cancelled");
    }

    const nonce = await this.contract.nonces(offer.maker);
    if (offer.nonce != nonce) {
      throw new Error("Invalid nonce");
    }
  }

  public async validateBidOffer(offer: MarketOffer) {
    const operator = await this.contract.getAddress();

    const buyerBalance = await currencyBalance(
      offer.maker,
      offer.terms.currency,
      offer.terms.amount,
      this.provider
    );

    if (!buyerBalance) {
      throw new Error("Insufficient buyer balance")
    }

    const buyerAllowance = await currencyAllowance(
      offer.maker,
      offer.terms.currency,
      operator,
      this.provider
    );

    if (buyerAllowance < BigInt(offer.terms.amount)) {
      throw new Error("Insufficient buyer allowance")
    }

    const cancelled = await this.contract.cancelledOrFulfilled(offer.maker, offer.salt);
    if (cancelled) {
      throw new Error("Offer has been cancelled");
    }

    const nonce = await this.contract.nonces(offer.maker);
    if (offer.nonce != nonce) {
      throw new Error("Invalid nonce");
    }
  }

  public async validateRepay(lien: Lien) {
    if (BigInt(lien.startTime) + BigInt(lien.duration) + BigInt(lien.gracePeriod) < getEpoch()) {
      throw new Error("Lien is defaulted");
    }

    const { debt } = await this.contract.currentDebtAmount(lien);

    const borrowerBalance = await currencyBalance(
      lien.borrower,
      lien.currency,
      debt,
      this.provider
    );

    if (!borrowerBalance) {
      throw new Error("Insufficient borrower balance")
    }
  }

  public async validateRefinance(
    taker: string, 
    lien: Lien, 
    offer: LoanOffer
  ) {
    if (!equalAddresses(taker, lien.borrower)) {
      throw new Error("Invalid borrower");
    }

    if (BigInt(lien.startTime) + BigInt(lien.duration) + BigInt(lien.gracePeriod) < getEpoch()) {
      throw new Error("Lien is defaulted");
    }

    const { debt } = await this.contract.currentDebtAmount(lien);

    if (debt > BigInt(offer.terms.maxAmount)) {
      const diff = debt - BigInt(offer.terms.maxAmount);

      const borrowerBalance = await currencyBalance(
        lien.borrower,
        lien.currency,
        diff,
        this.provider
      );

      if (!borrowerBalance) {
        throw new Error("Insufficient borrower balance")
      }
    }
  }

  public async validateSellInLien(
    taker: string,
    lien: Lien,
    offer: MarketOffer
  ) {
    if (!equalAddresses(taker, lien.borrower)) {
      throw new Error("Invalid borrower");
    }

    if (BigInt(lien.startTime) + BigInt(lien.duration) + BigInt(lien.gracePeriod) < getEpoch()) {
      throw new Error("Lien is defaulted");
    }

    const { debt } = await this.contract.currentDebtAmount(lien);

    if (debt > BigInt(offer.terms.amount)) {
      const diff = debt - BigInt(offer.terms.amount);

      const borrowerBalance = await currencyBalance(
        lien.borrower,
        lien.currency,
        diff,
        this.provider
      );

      if (!borrowerBalance) {
        throw new Error("Insufficient borrower balance")
      }
    }
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

  public getLoanOfferHash(offer: LoanOffer) {
    return this.contract.hashLoanOffer(offer);
  }

  public getBorrowOfferHash(offer: BorrowOffer) {
    return this.contract.hashBorrowOffer(offer);
  }

  public getMarketOfferHash(offer: MarketOffer) {
    return this.contract.hashMarketOffer(offer);
  }

  public async getLoanOfferMessageToSign(offer: LoanOffer) {
    const domain = await this._getDomainData();

    return TypedDataEncoder.hash(
      domain, 
      LOAN_OFFER_TYPE,
      offer
    )
  }

  public async getBorrowOfferMessageToSign(offer: BorrowOffer) {
    const domain = await this._getDomainData();

    return TypedDataEncoder.hash(
      domain, 
      BORROW_OFFER_TYPE,
      offer
    )
  }

  public async getMarketOfferMessageToSign(offer: MarketOffer) {
    const domain = await this._getDomainData();

    return TypedDataEncoder.hash(
      domain, 
      MARKET_OFFER_TYPE,
      offer
    )
  }

  public async validateLoanOfferSignature(
    maker: string,
    offer: LoanOffer, 
    signature: string
  ) {
    const message = await this.getLoanOfferMessageToSign(offer);
    const recovered = ethers.recoverAddress(message, signature);
    return equalAddresses(recovered, maker);
  }

  public async validateBorrowOfferSignature(
    maker: string,
    offer: BorrowOffer, 
    signature: string
  ) {
    const message = await this.getBorrowOfferMessageToSign(offer);
    const recovered = ethers.recoverAddress(message, signature);
    return equalAddresses(recovered, maker);
  }

  public async validateMarketOfferSignature(
    maker: string,
    offer: MarketOffer, 
    signature: string
  ) {
    const message = await this.getMarketOfferMessageToSign(offer);
    const recovered = ethers.recoverAddress(message, signature);
    return equalAddresses(recovered, maker);
  }

  public async getLoanOfferPayload(offer: LoanOffer) {
    const domain = await this._getDomainData();

    return TypedDataEncoder.getPayload(
      domain, 
      LOAN_OFFER_TYPE,
      offer
    )
  }

  public async getBorrowOfferPayload(offer: BorrowOffer) {
    const domain = await this._getDomainData();

    return TypedDataEncoder.getPayload(
      domain, 
      BORROW_OFFER_TYPE,
      offer
    )
  }

  public async getMarketOfferPayload(offer: MarketOffer) {
    const domain = await this._getDomainData();

    return TypedDataEncoder.getPayload(
      domain, 
      MARKET_OFFER_TYPE,
      offer
    )
  }

  public async signLoanOffer(
    offer: LoanOffer,
    accountAddress?: string
  ) {
    const signer = await this._getSigner(accountAddress);
    const domain = await this._getDomainData();
    
    return signer.signTypedData(
      domain, 
      LOAN_OFFER_TYPE, 
      offer
    );
  }

  public async signBorrowOffer(
    offer: BorrowOffer,
    accountAddress?: string
  ) {
    const signer = await this._getSigner(accountAddress);
    const domain = await this._getDomainData();

    return signer.signTypedData(
      domain, 
      BORROW_OFFER_TYPE,
      offer
    );
  }

  public async signMarketOffer(
    offer: MarketOffer,
    accountAddress?: string
  ) {
    const signer = await this._getSigner(accountAddress);
    const domain = await this._getDomainData();

    return signer.signTypedData(
      domain, 
      MARKET_OFFER_TYPE,
      offer
    );
  }

  public calculateMarketFee(
    amount: bigint,
    rate: bigint
  ) {
    return (amount * rate) / BigInt(BASIS_POINTS_DIVISOR);
  }

  private async _getSigner(
    accountAddress?: string,
  ): Promise<Signer | JsonRpcSigner> {
    if (this.signer) {
      return this.signer;
    }

    if (!("send" in this.provider)) {
      throw new Error(
        "Either signer or JsonRpcProvider with signer must be provided",
      );
    }

    return (this.provider as JsonRpcProvider).getSigner(accountAddress);
  }
}
