import {
  Multicall,
  ContractCallResults,
  ContractCallContext,
} from 'ethereum-multicall';

import { 
  Provider
} from 'ethers';

interface BalancesMulticallInput {
  lender: string;
  currency: string;
}

function balancesMulticall(provider: Provider, input: BalancesMulticallInput[]) {
  const context: ContractCallContext = input.map(({ currency, lender }) => ({
    reference: currency,
    contractAddress: lender,
    abi: ['function balanceOf(address) view returns (uint256)'],
    calls: [{ reference: 'balance', methodName: 'balanceOf', methodParameters: [lender] }],
  }));

  const result = new Multicall({ ethersProvider: provider }).call(context);
}