import { connect, disconnect, isConnected, getLocalStorage } from '@stacks/connect';
import { StacksNetwork, STACKS_MAINNET, STACKS_TESTNET } from '@stacks/network';


export const getNetwork = (): StacksNetwork => {
  const networkEnv = process.env.NEXT_PUBLIC_NETWORK || 'testnet';
  return networkEnv === 'mainnet' ? STACKS_MAINNET : STACKS_TESTNET;
};


export const connectWallet = async (onFinish?: () => void) => {
  try {
   
    if (isConnected()) {
      console.log('Already authenticated');
      if (onFinish) onFinish();
      return;
    }

    
    const response = await connect();
    console.log('Connected:', response.addresses);

    if (onFinish) onFinish();
  } catch (error) {
    console.error('Error connecting wallet:', error);
    throw error;
  }
};

export const disconnectWallet = () => {
  try {
    disconnect(); 
    console.log('User disconnected');
  } catch (error) {
    console.error('Error disconnecting wallet:', error);
  }
};


export const isWalletConnected = (): boolean => {
  return isConnected();
};

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


export const getUserData = () => {
  try {
    return getLocalStorage();
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};


export const fetchStxBalance = async (address: string): Promise<number> => {
  try {
    const network = getNetwork();
    const url = `${network.client.baseUrl}/v2/accounts/${address}`;

    const response = await fetch(url);
    const data = await response.json();

    
    return parseInt(data.balance) / 1_000_000;
  } catch (error) {
    console.error('Error fetching STX balance:', error);
    return 0;
  }
};


export const fetchSbtcBalance = async (address: string): Promise<number> => {
  try {
    const network = getNetwork();
    const url = `${network.client.baseUrl}/extended/v1/address/${address}/balances`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();

    if (!data.fungible_tokens) {
      console.log('No fungible tokens found for address');
      return 0;
    }

    
    let totalSbtcBalance = 0;
    
    
    const sbtcPatterns = [
      /\.sbtc::/i,           // Matches contracts ending with .sbtc::
      /sbtc-token::/i,       // Matches sbtc-token contracts
      /::sbtc$/i,            // Matches tokens ending with ::sbtc
      /::sBTC$/i,            // Matches tokens ending with ::sBTC
      /::sbtc-token$/i       // Matches tokens ending with ::sbtc-token
    ];

    
    const explicitContract = process.env.NEXT_PUBLIC_SBTC_CONTRACT;
    if (explicitContract) {
     
      const explicitPatterns = [
        `${explicitContract}::sbtc`,
        `${explicitContract}::sBTC`, 
        `${explicitContract}::sbtc-token`,
        explicitContract // In case the full path is provided
      ];
      
      for (const pattern of explicitPatterns) {
        const token = data.fungible_tokens[pattern];
        if (token) {
          console.log(`Found sBTC token: ${pattern}`, token);
          totalSbtcBalance += parseInt(token.balance);
        }
      }
    }

    // If no explicit contract found balance, search through all tokens
    if (totalSbtcBalance === 0) {
      Object.keys(data.fungible_tokens).forEach(tokenKey => {
        const isMatch = sbtcPatterns.some(pattern => pattern.test(tokenKey));
        if (isMatch) {
          const token = data.fungible_tokens[tokenKey];
          console.log(`Found sBTC token: ${tokenKey}`, token);
          totalSbtcBalance += parseInt(token.balance);
        }
      });
    }

    // Convert from smallest unit to BTC (assuming 8 decimal places like Bitcoin)
    return totalSbtcBalance / 100_000_000;
  } catch (error) {
    console.error('Error fetching sBTC balance:', error);
    return 0;
  }
};
