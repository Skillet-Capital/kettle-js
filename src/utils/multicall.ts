import {
  ContractCallContext
} from 'ethereum-multicall';

import { ItemType, Lien } from '../types';
import { LoanOfferWithHash, } from "../types";

interface OfferCollaterals {
  maker: string;
  collection: string;
  itemType: ItemType;
  identifier: string | number | bigint;
}

interface OfferCurrencies {
  maker: string;
  currency: string;
}

interface OfferCancellationFulfillmentNonce {
  maker: string;
  salt: string | number | bigint;
}

interface CurrencyMap {
  [currency: string]: string[];
}

interface CollateralMapValue {
  maker: string;
  identifier: string | number | bigint;
}

interface CollateralMap {
  [collection: string]: {
    itemType: ItemType;
    collateral: CollateralMapValue[];
  };
}

interface LienCollateralMap {
  [identifier: string]: Lien;
}

export function buildMakerCollateralBalancesAndAllowancesCallContext(
  offerCollaterals: OfferCollaterals[],
  operator: string
): ContractCallContext[] {

  const _collateralMap: { [collection: string]: { itemType: ItemType, collateral: CollateralMapValue[] } } = offerCollaterals.reduce(
    (acc: CollateralMap, offerCollateral) => {
      const { maker, collection, itemType, identifier } = offerCollateral;

      if (!acc[collection]) {
        acc[collection] = {
          itemType,
          collateral: [{ maker, identifier }]
        };
      } else {
        acc[collection].collateral.push({ maker, identifier });
      }

      return acc;
    },
    {}
  );

  return Object.entries(_collateralMap).map(([collection, { itemType, collateral }]) => {
    if (itemType === ItemType.ERC721) {
      return ({
        reference: collection,
        contractAddress: collection,
        abi: [
          { name: 'ownerOf', "stateMutability": "view", type: 'function', inputs: [{ type: 'uint256', name: 'tokenId' }], outputs: [{ type: 'address', name: 'owner' }] },
          { name: 'isApprovedForAll', "stateMutability": "view", type: 'function', inputs: [{ type: 'address', name: 'owner' }, { type: 'address', name: 'operator' }], outputs: [{ type: 'bool', name: 'approved' }] }
        ],
        calls: [
          ...collateral.map(({ identifier }) => ({
            reference: identifier.toString(),
            methodName: 'ownerOf',
            methodParameters: [identifier]
          })),
          ...collateral.map(({ maker }) => ({
            reference: maker,
            methodName: 'isApprovedForAll',
            methodParameters: [maker, operator]
          }))
        ]
      })
    } else {
      return ({
        reference: collection,
        contractAddress: collection,
        abi: [
          { name: 'balanceOf', "stateMutability": "view", type: 'function', inputs: [{ type: 'address', name: 'account' }, { type: 'uint256', name: 'tokenId' }], outputs: [{ type: 'uint256', name: 'balance' }] },
          { name: 'isApprovedForAll', "stateMutability": "view", type: 'function', inputs: [{ type: 'address', name: 'owner' }, { type: 'address', name: 'operator' }], outputs: [{ type: 'bool', name: 'approved' }] }
        ],
        calls: [
          ...collateral.map(({ maker, identifier }) => ({
            reference: `${maker}-${identifier}`.toString(),
            methodName: 'balanceOf',
            methodParameters: [maker, identifier]
          })),
          ...collateral.map(({ maker }) => ({
            reference: maker,
            methodName: 'isApprovedForAll',
            methodParameters: [maker, operator]
          }))
        ]
      })
    }
  }).flat();
}

export function buildMakerBalancesAndAllowancesCallContext(
  offerCurrencies: OfferCurrencies[],
  operator: string
): ContractCallContext[] {

  const _currencyMap: { [currency: string]: string[] } = offerCurrencies.reduce(
    (acc: CurrencyMap, offerCurrency) => {
      const { maker, currency } = offerCurrency;

      if (!acc[currency]) {
        acc[currency] = [maker];
      } else {
        acc[currency].push(maker);
      }

      return acc;
    },
    {}
  );

  return Object.entries(_currencyMap).map(([currency, makers]) => ({
    reference: currency,
    contractAddress: currency,
    abi: [
      { name: 'balanceOf', "stateMutability": "view", type: 'function', inputs: [{ type: 'address', name: 'account' }], outputs: [{ type: 'uint256', name: 'balance' }] },
      { name: 'allowance', "stateMutability": "view", type: 'function', inputs: [{ type: 'address', name: 'owner' }, { type: 'address', name: 'spender' }], outputs: [{ type: 'uint256', name: 'remaining' }] }
    ],
    calls: [
      ...makers.map((maker) => ({
        reference: maker,
        methodName: 'balanceOf',
        methodParameters: [maker]
      })),
      ...makers.map((maker) => ({
        reference: maker,
        methodName: 'allowance',
        methodParameters: [maker, operator]
      }))
    ]
  })).flat()
}

export function buildCancelledFulfilledAndNonceMulticallContext(
  offerContexts: OfferCancellationFulfillmentNonce[],
  kettleAddress: string
): ContractCallContext[] {

  return [({
    reference: "kettle",
    contractAddress: kettleAddress,
    abi: [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "cancelledOrFulfilled",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "",
            "type": "address"
          }
        ],
        "name": "nonces",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
    ],
    calls: [
      ...offerContexts.map(
        (_context) => ({
          reference: `${_context.maker}-${_context.salt}`.toLowerCase(),
          methodName: "cancelledOrFulfilled",
          methodParameters: [_context.maker, _context.salt]
        }),
      ),
      ...offerContexts.map(
        (_context) => ({
          reference: _context.maker,
          methodName: "nonces",
          methodParameters: [_context.maker]
        }),
      )
    ]
  })]
}

export function buildAmountTakenMulticallCallContext(
  offers: LoanOfferWithHash[],
  kettleAddress: string
): ContractCallContext[] {

  return [({
    reference: "kettleAmountTaken",
    contractAddress: kettleAddress,
    abi: [
      {
        "inputs": [
          {
            "internalType": "bytes32",
            "name": "_hash",
            "type": "bytes32"
          }
        ],
        "name": "amountTaken",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ],
    calls: [
      ...offers.map(
        (offer) => ({
          reference: offer.hash,
          methodName: "amountTaken",
          methodParameters: [offer.hash]
        }),
      )
    ]
  })]
}

export function buildCurrentDebtAmountMulticallCallContext(
  lienCollaterals: LienCollateralMap,
  kettleAddress: string
): ContractCallContext[] {

  return [({
    reference: "kettleCurrentDebtAmount",
    contractAddress: kettleAddress,
    abi: [
      {
        "inputs": [
          {
            "components": [
              {
                "internalType": "address",
                "name": "recipient",
                "type": "address"
              },
              {
                "internalType": "address",
                "name": "borrower",
                "type": "address"
              },
              {
                "internalType": "address",
                "name": "currency",
                "type": "address"
              },
              {
                "internalType": "address",
                "name": "collection",
                "type": "address"
              },
              {
                "internalType": "enum ItemType",
                "name": "itemType",
                "type": "uint8"
              },
              {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "size",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "principal",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "fee",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "rate",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "defaultRate",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "duration",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "gracePeriod",
                "type": "uint256"
              },
              {
                "internalType": "uint256",
                "name": "startTime",
                "type": "uint256"
              }
            ],
            "internalType": "struct Lien",
            "name": "lien",
            "type": "tuple"
          }
        ],
        "name": "currentDebtAmount",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "debt",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "fee",
            "type": "uint256"
          },
          {
            "internalType": "uint256",
            "name": "interest",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
    ],
    calls: [
      ...Object.entries(lienCollaterals).map(
        ([identifier, lien]) => ({
          reference: identifier,
          methodName: "currentDebtAmount",
          methodParameters: [lien]
        }),
      )
    ]
  })]
}

// const lenderCurrencies: { [currency: string]: string[] } = offers.reduce(
//   (acc: LenderCurrencies, offer) => {
//     const { lender, terms } = offer;
//     const { currency } = terms;
  
//     if (!acc[currency]) {
//       acc[currency] = [lender];
//     } else {
//       acc[currency].push(lender);
//     }
  
//     return acc;
//   }, 
//   {}
// );

// const callContext: ContractCallContext[] = [
//   ...Object.entries(lenderCurrencies).map(([currency, lenders]) => ({
//     reference: currency,
//     contractAddress: currency,
//     abi: [
//       { name: 'balanceOf', "stateMutability": "view", type: 'function', inputs: [{ type: 'address', name: 'account' }], outputs: [{ type: 'uint256', name: 'balance' }] },
//       { name: 'allowance', "stateMutability": "view", type: 'function', inputs: [{ type: 'address', name: 'owner' }, { type: 'address', name: 'spender' }], outputs: [{ type: 'uint256', name: 'remaining' }] }
//     ],
//     calls: [
//       ...lenders.map((lender) => ({
//         reference: lender,
//         methodName: 'balanceOf',
//         methodParameters: [lender]
//       })),
//       ...lenders.map((lender) => ({
//         reference: lender,
//         methodName: 'allowance',
//         methodParameters: [lender, this.contractAddress]
//       }))
//     ]
//   })).flat(),
  
//   ({
//     reference: "kettle",
//     contractAddress: this.contractAddress,
//     abi: [
//       {
//         "inputs": [
//           {
//             "internalType": "bytes32",
//             "name": "_hash",
//             "type": "bytes32"
//           }
//         ],
//         "name": "amountTaken",
//         "outputs": [
//           {
//             "internalType": "uint256",
//             "name": "",
//             "type": "uint256"
//           }
//         ],
//         "stateMutability": "view",
//         "type": "function"
//       },
//       {
//         "inputs": [
//           {
//             "internalType": "address",
//             "name": "",
//             "type": "address"
//           },
//           {
//             "internalType": "uint256",
//             "name": "",
//             "type": "uint256"
//           }
//         ],
//         "name": "cancelledOrFulfilled",
//         "outputs": [
//           {
//             "internalType": "uint256",
//             "name": "",
//             "type": "uint256"
//           }
//         ],
//         "stateMutability": "view",
//         "type": "function"
//       },
//       {
//         "inputs": [
//           {
//             "internalType": "address",
//             "name": "",
//             "type": "address"
//           }
//         ],
//         "name": "nonces",
//         "outputs": [
//           {
//             "internalType": "uint256",
//             "name": "",
//             "type": "uint256"
//           }
//         ],
//         "stateMutability": "view",
//         "type": "function"
//       },
//     ],
//     calls: [
//       ...offers.map(
//         (offer) => ({
//           reference: offer.hash,
//           methodName: "amountTaken",
//           methodParameters: [offer.hash]
//         }),
//       ),
//       ...offers.map(
//         (offer) => ({
//           reference: offer.lender,
//           methodName: "cancelledOrFulfilled",
//           methodParameters: [offer.lender, offer.salt]
//         }),
//       ),
//       ...offers.map(
//         (offer) => ({
//           reference: offer.lender,
//           methodName: "nonces",
//           methodParameters: [offer.lender]
//         }),
//       )
//     ]
//   })
// ];
