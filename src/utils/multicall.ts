import {
  ContractCallContext
} from 'ethereum-multicall';

import { ItemType } from '../types';
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
  itemType: ItemType;
  identifier: string | number | bigint;
}

interface CollateralMap {
  [collection: string]: CollateralMapValue[];
}

export function buildMakerCollateralBalancesAndAllowancesCallContext(
  offerCollaterals: OfferCollaterals[],
  operator: string
): ContractCallContext[] {

  const _collateralMap: { [collection: string]: CollateralMapValue[] } = offerCollaterals.reduce(
    (acc: CollateralMap, offerCollateral) => {
      const { maker, collection, itemType, identifier } = offerCollateral;

      if (!acc[collection]) {
        acc[collection] = [{ maker, itemType, identifier }];
      } else {
        acc[collection].push({ maker, itemType, identifier });
      }

      return acc;
    },
    {}
  );

  return Object.entries(_collateralMap).map(([collection, values]) => {
    return values.map(({ maker, itemType, identifier }) => {
      if (itemType === ItemType.ERC721) {
        return ({
          reference: collection,
          contractAddress: collection,
          abi: [
            { name: 'ownerOf', "stateMutability": "view", type: 'function', inputs: [{ type: 'uint256', name: 'tokenId' }], outputs: [{ type: 'address', name: 'owner' }] },
            { name: 'isApprovedForAll', "stateMutability": "view", type: 'function', inputs: [{ type: 'address', name: 'owner' }, { type: 'address', name: 'operator' }], outputs: [{ type: 'bool', name: 'approved' }] }
          ],
          calls: [
            {
              reference: identifier.toString(),
              methodName: 'ownerOf',
              methodParameters: [identifier]
            },
            {
              reference: maker,
              methodName: 'isApprovedForAll',
              methodParameters: [maker, operator]
            }
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
            {
              reference: `${maker}-${identifier}`.toLowerCase(),
              methodName: 'balanceOf',
              methodParameters: [maker]
            },
            {
              reference: maker,
              methodName: 'isApprovedForAll',
              methodParameters: [maker, operator]
            }
          ]
        })
      }
    })
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
          reference: _context.maker,
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
    reference: "kettle",
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
