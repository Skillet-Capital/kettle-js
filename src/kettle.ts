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
    input: CreateBorrowOfferInput
  ): Promise<(ApprovalAction | CreateOrderAction)[]>
  {
    const signer = this.signer;
    const offerer = await signer!.getAddress();
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
    input: CreateMarketOfferInput
  ): Promise<(ApprovalAction | CreateOrderAction)[]>{
    const signer = this.signer;
    const offerer = await signer!.getAddress();
    const operator = await this.contract.getAddress();

    const offer = await this._formatMarketOffer(Side.ASK, offerer!, input);

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

  public async takeBorrowOffer(
    offer: BorrowOffer,
    signature: string
  ): Promise<(ApprovalAction | TakeOrderAction)[]> {
    const signer = this.signer;
    const taker = await signer!.getAddress();
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

  public async takeAskOffer(
    offer: MarketOffer, 
    signature: string
  ): Promise<(ApprovalAction | TakeOrderAction)[]> {
    const signer = this.signer;
    const taker = await signer!.getAddress();
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

  public async takeBidOffer(
    offer: MarketOffer, 
    signature: string
  ): Promise<(ApprovalAction | TakeOrderAction)[]> {
    const signer = this.signer;
    const taker = await signer!.getAddress();
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

  public async repay(
    lienId: bigint | number,
    lien: Lien
  ): Promise<(ApprovalAction | RepayAction)[]>{
    const signer = this.signer;
    const taker = await signer!.getAddress();
    const operator = await this.contract.getAddress();

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

  public claim(
    lienId: bigint | number,
    lien: Lien
  ): ClaimAction {
    if (BigInt(lien.startTime) + BigInt(lien.duration) + BigInt(lien.gracePeriod) > getEpoch()) {
      throw new Error("Lien is not defaulted");
    }
    const signer = this.signer;

    const claimAction = {
      type: "claim",
      claim: async () => {
        return await this.contract.connect(signer).repay(lienId, lien)
      }
    } as const;

    return claimAction;
  }

  public cancelOffer(
    offer: LoanOffer | MarketOffer
  ): CancelOrderAction {
    const signer = this.signer;

    return {
      type: "cancel",
      cancelOrder: () => {
        return this.contract.connect(signer).cancelOffer(offer.salt);
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
      duration,
      gracePeriod,
      expiration
    }: CreateLoanOfferInput,
  ): Promise<LoanOffer> {

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
      nonce
    };
  }

  private async _formatBorrowOffer(
    offerer: string,
    {
      collection,
      criteria,
      itemType,
      identifier,
      size,
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
      criteria,
      itemType,
      identifier,
      size,
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
      nonce
    };
  }

  private async _formatMarketOffer(
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
  ): Promise<MarketOffer> {
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
    const nonce = await this.contract.nonces(offerer);

    return {
      side,
      maker: offerer,
      collateral,
      terms,
      fee: feeTerms,
      expiration,
      salt,
      nonce
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

  public async validateAskOffer(offer: MarketOffer) {
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

    if (!sellerAllowance) {
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
    return ethers.recoverAddress(message, signature) === maker;
  }

  public async validateBorrowOfferSignature(
    maker: string,
    offer: BorrowOffer, 
    signature: string
  ) {
    const message = await this.getBorrowOfferMessageToSign(offer);
    return ethers.recoverAddress(message, signature) === maker;
  }

  public async validateMarketOfferSignature(
    maker: string,
    offer: MarketOffer, 
    signature: string
  ) {
    const message = await this.getMarketOfferMessageToSign(offer);
    return ethers.recoverAddress(message, signature) === maker;
  }

  public async signLoanOffer(offer: LoanOffer) {
    const domain = await this._getDomainData();
    
    return this.signer!.signTypedData(
      domain, 
      LOAN_OFFER_TYPE, 
      offer
    );
  }

  public async signBorrowOffer(offer: BorrowOffer) {
    const domain = await this._getDomainData();

    return this.signer!.signTypedData(
      domain, 
      BORROW_OFFER_TYPE,
      offer
    );
  }

  public async signMarketOffer(offer: MarketOffer) {
    const domain = await this._getDomainData();

    return this.signer!.signTypedData(
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
}
