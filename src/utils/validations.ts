import { LienWithLender, Lien } from "../types";
import { equalAddresses } from "./equalAddresses";
import { getEpoch } from './time';

export function offerIsExpired(expiration: string | number | bigint): boolean {
  return BigInt(expiration) < getEpoch()
}

function getLienEndTime(lien: LienWithLender | Lien): bigint {
  return BigInt(lien.startTime) + BigInt(lien.duration) + BigInt(lien.gracePeriod)
}

export function lienIsCurrent(lien: LienWithLender | Lien): boolean {
  return getLienEndTime(lien) > getEpoch();
}

export function lienIsDefaulted(lien: LienWithLender | Lien): boolean {
  return getLienEndTime(lien) < getEpoch();
}

export function lienMatchesOfferCollateral(
  lien: LienWithLender,
  collection: string,
  identifier: string | number | bigint,
  currency: string
): boolean {
  return (
    equalAddresses(lien.collection, collection)
    && equalAddresses(lien.currency, currency)
    && lien.tokenId === identifier
  )
}
