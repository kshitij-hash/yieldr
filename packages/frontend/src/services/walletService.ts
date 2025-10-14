// Wallet Service for Stacks Connect Integration
import { connect, disconnect, isConnected, getLocalStorage } from '@stacks/connect';
import { StacksNetwork, STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';

// Get current network
export const getNetwork = (): StacksNetwork => {
  const networkEnv = process.env.NEXT_PUBLIC_NETWORK || 'testnet';
  return networkEnv === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
};

// Connect wallet
export const connectWallet = async (onFinish?: () => void) => {
  try {
    // Check if already connected
    if (isConnected()) {
      console.log('Already authenticated');
      if (onFinish) onFinish();
      return;
    }

    // Connect to wallet
    const response = await connect();
    console.log('Connected:', response.addresses);

    if (onFinish) onFinish();
  } catch (error) {
    console.error('Error connecting wallet:', error);
    throw error;
  }
};

// Disconnect wallet
export const disconnectWallet = () => {
  try {
    disconnect(); // Clears storage and wallet selection
    console.log('User disconnected');
  } catch (error) {
    console.error('Error disconnecting wallet:', error);
  }
};

// Check if wallet is connected
export const isWalletConnected = (): boolean => {
  return isConnected();
};

// Get user address
export const getUserAddress = (): string | null => {
  try {
    const userData = getLocalStorage();
    if (userData?.addresses?.stx && userData.addresses.stx.length > 0) {
      return userData.addresses.stx[0].address;
    }
    return null;
  } catch (error) {
    console.error('Error getting user address:', error);
    return null;
  }
};

// Get user data
export const getUserData = () => {
  try {
    return getLocalStorage();
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

// Fetch STX balance
export const fetchStxBalance = async (address: string): Promise<number> => {
  try {
    const network = getNetwork();
    const url = `${network.client.baseUrl}/v2/accounts/${address}`;

    const response = await fetch(url);
    const data = await response.json();

    // Convert microSTX to STX
    return parseInt(data.balance) / 1_000_000;
  } catch (error) {
    console.error('Error fetching STX balance:', error);
    return 0;
  }
};

// Fetch sBTC balance (assuming SIP-010 token)
export const fetchSbtcBalance = async (address: string): Promise<number> => {
  try {
    const network = getNetwork();
    const networkEnv = process.env.NEXT_PUBLIC_NETWORK || 'testnet';

    // Get sBTC contract address from env or use defaults
    let contractAddress: string;
    if (process.env.NEXT_PUBLIC_SBTC_CONTRACT) {
      // Use explicitly set contract from env
      contractAddress = process.env.NEXT_PUBLIC_SBTC_CONTRACT;
    } else if (networkEnv === 'mainnet') {
      // Mainnet sBTC contract default
      contractAddress = 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token';
    } else {
      // Testnet sBTC contract default
      contractAddress = 'ST1R1061ZT6KPJXQ7PAXPFB6ZAZ6ZWW28GBQA1W0F.sbtc-token';
    }

    const url = `${network.client.baseUrl}/extended/v1/address/${address}/balances`;

    const response = await fetch(url);
    const data = await response.json();

    // Find sBTC token balance - need to search with full contract path including token name
    const sbtcToken = data.fungible_tokens?.[`${contractAddress}::sbtc-token`] || data.fungible_tokens?.[contractAddress];
    if (sbtcToken) {
      // Convert sats to BTC
      return parseInt(sbtcToken.balance) / 100_000_000;
    }

    return 0;
  } catch (error) {
    console.error('Error fetching sBTC balance:', error);
    return 0;
  }
};
