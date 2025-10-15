// Contract Service for BitYield Vault interactions
import {
  fetchCallReadOnlyFunction,
  cvToJSON,
  uintCV,
  principalCV,
  PostConditionMode,
} from "@stacks/transactions";
import { openContractCall } from "@stacks/connect";
import { getNetwork } from "./walletService";
import { VaultBalance } from "@/types";

// Contract details
const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "STKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38GTENFFQ";
const CONTRACT_NAME =
  process.env.NEXT_PUBLIC_CONTRACT_NAME || "bityield-vault-updated";

// Read-only function: Get user balance
export const getUserVaultBalance = async (
  userAddress: string
): Promise<number> => {
  try {
    const network = getNetwork();
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "get-balance",
      functionArgs: [principalCV(userAddress)],
      network,
      senderAddress: userAddress,
    });

    const jsonResult = cvToJSON(result);
    return parseInt(jsonResult.value) / 100_000_000; // Convert sats to BTC
  } catch (error) {
    console.error("Error fetching vault balance:", error);
    return 0;
  }
};

// Read-only function: Get total TVL
export const getTotalTvl = async (): Promise<number> => {
  try {
    const network = getNetwork();
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "get-total-tvl",
      functionArgs: [],
      network,
      senderAddress: CONTRACT_ADDRESS,
    });

    const jsonResult = cvToJSON(result);
    return parseInt(jsonResult.value) / 100_000_000; // Convert sats to BTC
  } catch (error) {
    console.error("Error fetching TVL:", error);
    return 0;
  }
};

// Read-only function: Get depositor count
export const getDepositorCount = async (): Promise<number> => {
  try {
    const network = getNetwork();
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "get-depositor-count",
      functionArgs: [],
      network,
      senderAddress: CONTRACT_ADDRESS,
    });

    const jsonResult = cvToJSON(result);
    return parseInt(jsonResult.value);
  } catch (error) {
    console.error("Error fetching depositor count:", error);
    return 0;
  }
};

// Read-only function: Check if contract is paused
export const isContractPaused = async (): Promise<boolean> => {
  try {
    const network = getNetwork();
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "is-paused",
      functionArgs: [],
      network,
      senderAddress: CONTRACT_ADDRESS,
    });

    const jsonResult = cvToJSON(result);
    return jsonResult.value === true;
  } catch (error) {
    console.error("Error checking pause status:", error);
    return false;
  }
};

// Get all vault data
export const getVaultData = async (
  userAddress: string
): Promise<VaultBalance> => {
  try {
    const [userBalance, totalTvl, depositorCount] = await Promise.all([
      getUserVaultBalance(userAddress),
      getTotalTvl(),
      getDepositorCount(),
    ]);

    return {
      userBalance,
      totalTvl,
      depositorCount,
    };
  } catch (error) {
    console.error("Error fetching vault data:", error);
    return {
      userBalance: 0,
      totalTvl: 0,
      depositorCount: 0,
    };
  }
};

// Deposit sBTC into vault
export const depositSbtc = async (
  amount: number,
  onFinish?: (data: { txId: string }) => void,
  onCancel?: () => void
): Promise<void> => {
  const network = getNetwork();
  const amountInSats = Math.floor(amount * 100_000_000); // Convert BTC to sats

  try {
    openContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "deposit-sbtc",
      functionArgs: [uintCV(amountInSats)],
      postConditionMode: PostConditionMode.Allow, // Allow mode to skip post-condition checks
      network,
      onFinish: (data) => {
        console.log("Deposit transaction submitted:", data.txId);
        if (onFinish) onFinish(data);
      },
      onCancel: () => {
        console.log("Deposit cancelled");
        if (onCancel) onCancel();
      },
    });
  } catch (error) {
    console.error("Error depositing sBTC:", error);
    throw error;
  }
};

// Withdraw sBTC from vault
export const withdrawSbtc = async (
  amount: number,
  onFinish?: (data: { txId: string }) => void,
  onCancel?: () => void
): Promise<void> => {
  const network = getNetwork();
  const amountInSats = Math.floor(amount * 100_000_000); // Convert BTC to sats

  try {
    openContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "withdraw-sbtc",
      functionArgs: [uintCV(amountInSats)],
      postConditionMode: PostConditionMode.Allow, // Allow mode to skip post-condition checks
      network,
      onFinish: (data) => {
        console.log("Withdrawal transaction submitted:", data.txId);
        if (onFinish) onFinish(data);
      },
      onCancel: () => {
        console.log("Withdrawal cancelled");
        if (onCancel) onCancel();
      },
    });
  } catch (error) {
    console.error("Error withdrawing sBTC:", error);
    throw error;
  }
};

// Get transaction status from Stacks API
export const getTransactionStatus = async (txId: string): Promise<string> => {
  try {
    const network = getNetwork();
    const url = `${network.client.baseUrl}/extended/v1/tx/${txId}`;

    const response = await fetch(url);
    const data = await response.json();

    return data.tx_status;
  } catch (error) {
    console.error("Error fetching transaction status:", error);
    return "unknown";
  }
};

// Get explorer URL for transaction
export const getExplorerUrl = (txId: string): string => {
  const network = getNetwork();
  const isMainnet = network.chainId === 1;

  if (isMainnet) {
    return `https://explorer.hiro.so/txid/${txId}?chain=mainnet`;
  } else {
    return `https://explorer.hiro.so/txid/${txId}?chain=testnet`;
  }
};

// Read-only function: Get deposit timestamp
export const getDepositTimestamp = async (
  userAddress: string
): Promise<number> => {
  try {
    const network = getNetwork();
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "get-deposit-timestamp",
      functionArgs: [principalCV(userAddress)],
      network,
      senderAddress: userAddress,
    });

    const jsonResult = cvToJSON(result);
    return parseInt(jsonResult.value);
  } catch (error) {
    console.error("Error fetching deposit timestamp:", error);
    return 0;
  }
};

// Read-only function: Get withdrawal timestamp
export const getWithdrawalTimestamp = async (
  userAddress: string
): Promise<number> => {
  try {
    const network = getNetwork();
    const result = await fetchCallReadOnlyFunction({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "get-withdrawal-timestamp",
      functionArgs: [principalCV(userAddress)],
      network,
      senderAddress: userAddress,
    });

    const jsonResult = cvToJSON(result);
    return parseInt(jsonResult.value);
  } catch (error) {
    console.error("Error fetching withdrawal timestamp:", error);
    return 0;
  }
};

// Deposit sBTC for another user
export const depositFor = async (
  recipient: string,
  amount: number,
  onFinish?: (data: { txId: string }) => void,
  onCancel?: () => void
): Promise<void> => {
  const network = getNetwork();
  const amountInSats = Math.floor(amount * 100_000_000); // Convert BTC to sats

  try {
    openContractCall({
      contractAddress: CONTRACT_ADDRESS,
      contractName: CONTRACT_NAME,
      functionName: "deposit-for",
      functionArgs: [principalCV(recipient), uintCV(amountInSats)],
      postConditionMode: PostConditionMode.Allow, // Allow mode to skip post-condition checks
      network,
      onFinish: (data) => {
        console.log("Deposit-for transaction submitted:", data.txId);
        if (onFinish) onFinish(data);
      },
      onCancel: () => {
        console.log("Deposit-for cancelled");
        if (onCancel) onCancel();
      },
    });
  } catch (error) {
    console.error("Error depositing sBTC for recipient:", error);
    throw error;
  }
};
