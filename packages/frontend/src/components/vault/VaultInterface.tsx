'use client';

import React from 'react';
import { Vault, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DepositForm } from './DepositForm';
import { WithdrawalForm } from './WithdrawalForm';
import { DepositForForm } from './DepositForForm';
import { TransactionHistory } from './TransactionHistory';
import { useContract } from '@/hooks/useContract';
import { useWallet } from '@/contexts/WalletContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export const VaultInterface: React.FC = () => {
  const { isConnected } = useWallet();
  const { vaultData, isPaused, isLoading, error } = useContract();

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>BitYield Vault</CardTitle>
          <CardDescription>Connect your wallet to interact with the vault</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Vault className="h-4 w-4" />
            <AlertDescription>
              Please connect your wallet to deposit or withdraw sBTC.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Show contract not deployed warning
  if (error === 'CONTRACT_NOT_DEPLOYED') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>BitYield Vault</CardTitle>
          <CardDescription>Contract deployment required</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-semibold">The vault contract is not deployed yet.</p>
                <p className="text-sm">
                  The contract needs to be deployed to {process.env.NEXT_PUBLIC_NETWORK || 'testnet'} before you can interact with it.
                </p>
              </div>
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border p-4 space-y-3">
            <h4 className="font-semibold text-sm">To deploy the contract:</h4>
            <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
              <li>Navigate to the project root directory</li>
              <li>Run: <code className="bg-muted px-1.5 py-0.5 rounded">clarinet deployments apply --testnet</code></li>
              <li>Update <code className="bg-muted px-1.5 py-0.5 rounded">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in <code className="bg-muted px-1.5 py-0.5 rounded">.env.local</code></li>
              <li>Restart the development server</li>
            </ol>
            <p className="text-sm text-muted-foreground mt-3">
              See <code className="bg-muted px-1.5 py-0.5 rounded">frontend/DEPLOYMENT-GUIDE.md</code> for detailed instructions.
            </p>
          </div>

          <Alert>
            <AlertDescription className="text-sm">
              <strong>Current contract address:</strong><br />
              <code className="text-xs">{process.env.NEXT_PUBLIC_CONTRACT_ADDRESS}</code>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Vault Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Balance</CardTitle>
            <Vault className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{vaultData.userBalance.toFixed(4)} sBTC</div>
                <p className="text-xs text-muted-foreground mt-1">
                  In vault
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total TVL</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">{vaultData.totalTvl.toFixed(2)} sBTC</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total value locked
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Depositors</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{vaultData.depositorCount}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Unique depositors
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pause Warning */}
      {isPaused && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            The vault contract is currently paused. Deposits and withdrawals are temporarily disabled.
          </AlertDescription>
        </Alert>
      )}

      {/* Deposit/Withdrawal Interface */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Vault Operations</CardTitle>
              <CardDescription>Deposit or withdraw your sBTC</CardDescription>
            </div>
            <Badge variant={isPaused ? 'destructive' : 'default'}>
              {isPaused ? 'Paused' : 'Active'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="deposit" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="deposit" disabled={isPaused}>
                Deposit
              </TabsTrigger>
              <TabsTrigger value="withdraw" disabled={isPaused}>
                Withdraw
              </TabsTrigger>
              <TabsTrigger value="gift" disabled={isPaused}>
                Gift
              </TabsTrigger>
            </TabsList>

            <Separator className="my-6" />

            <TabsContent value="deposit" className="space-y-4">
              <DepositForm />
            </TabsContent>

            <TabsContent value="withdraw" className="space-y-4">
              <WithdrawalForm />
            </TabsContent>

            <TabsContent value="gift" className="space-y-4">
              <DepositForForm />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <TransactionHistory />
    </div>
  );
};
