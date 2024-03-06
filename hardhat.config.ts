import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@typechain/hardhat";

// Go to https://hardhat.org/config to learn more
const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.20",
        settings: {
          viaIR: true,
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yulDetails: {
                optimizerSteps: "u",
              },
            },
          },
        },
      },
    ],
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      chainId: 1,
    },
  },
  typechain: {
    outDir: "src/typechain-types",
    target: "ethers-v6",
  },
  paths: {
    tests: "test",
    artifacts: "src/artifacts",
    sources: "src/contracts",
  },
};

export default config;
