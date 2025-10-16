import { fetchCallReadOnlyFunction, cvToJSON } from '@stacks/transactions';
import { STACKS_TESTNET } from '@stacks/network';

const contractAddress = 'STKBH2VR2QNEFQDNCVRS7K3DJVQ3WYB38GTENFFQ';
const contractName = 'pool-oracle';
const functionName = 'get-all-data';

console.log('Testing contract call...');
console.log(`Contract: ${contractAddress}.${contractName}`);
console.log(`Function: ${functionName}`);
console.log(`Network: testnet`);
console.log('');

try {
  const result = await fetchCallReadOnlyFunction({
    contractAddress,
    contractName,
    functionName,
    functionArgs: [],
    network: STACKS_TESTNET,
    senderAddress: contractAddress,
  });

  console.log('✅ Contract call successful!');
  console.log('Raw result:', result);
  console.log('');

  const jsonResult = cvToJSON(result);
  console.log('JSON result:', JSON.stringify(jsonResult, null, 2));

} catch (error) {
  console.error('❌ Contract call failed:');
  console.error(error);
}
