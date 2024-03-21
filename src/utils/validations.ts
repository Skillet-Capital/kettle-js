import { LienWithLender } from "../types";
import { equalAddresses } from "./equalAddresses";
import { getEpoch } from './time';

export function isCurrentLien(lien: LienWithLender): boolean {
  return ((
    BigInt(lien.startTime) 
    + BigInt(lien.duration) 
    + BigInt(lien.gracePeriod)
  ) > getEpoch())
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
