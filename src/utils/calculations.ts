// Constants
const WAD = BigInt(1000000000000000000); // 1e18
const YEAR_WAD: bigint = BigInt(365 * 24 * 60 * 60) * WAD; // Days in a year * precision
const BASIS_POINTS: bigint = BigInt(10_000);

// Helper functions for arithmetic operations, adapted for bigint
function bipsToSignedWads(bips: bigint): bigint {
  return (bips * WAD) / BASIS_POINTS;
}

function computeCurrentDebt(
  amount: bigint,
  rate: bigint,
  startTime: bigint,
  endTime: bigint
): bigint {
  const loanTime: bigint = endTime - startTime;
  const yearsWad: bigint = (loanTime * WAD) / YEAR_WAD;
  const rateWad: bigint = bipsToSignedWads(rate);
  // Simplified version of `wadExp` and `wadMul` using bigint arithmetic directly
  // Note: This is a simplified approximation; for actual exponentiation, consider using a more accurate method.
  const expResult: bigint = (yearsWad * rateWad) / WAD; // Simplified exponentiation approximation
  console.log(yearsWad, rateWad, expResult)
  return amount * (BigInt(1) + expResult);
}

// Example usage within an async function to interact with the blockchain
export function currentDebtAmount(
  currentTime: bigint,
  principal: bigint,
  startTime: bigint,
  duration: bigint,
  fee: bigint,
  rate: bigint,
  defaultRate: bigint
): [bigint, bigint, bigint] {
  let debtWithFee: bigint = computeCurrentDebt(
    principal,
    fee,
    startTime,
    currentTime
  );

  console.log(debtWithFee);

  let debtWithRate: bigint;
  if (currentTime > startTime + duration) {
    debtWithRate = computeCurrentDebt(
      principal,
      rate,
      startTime,
      startTime + duration
    );
    debtWithRate = computeCurrentDebt(
      debtWithRate,
      defaultRate,
      startTime + duration,
      currentTime
    );
  } else {
    debtWithRate = computeCurrentDebt(
      principal,
      rate,
      startTime,
      currentTime
    );
  }

  const feeInterest: bigint = debtWithFee - principal;
  const lenderInterest: bigint = debtWithRate - principal;
  const debt: bigint = principal + feeInterest + lenderInterest;

  return [debt, feeInterest, lenderInterest];
}
