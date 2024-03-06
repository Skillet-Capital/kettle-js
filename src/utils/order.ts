import { randomBytes } from "ethers";

export const generateRandomSalt = () => {
  return `0x${Buffer.from(randomBytes(8)).toString("hex").padStart(64, "0")}`;
};
