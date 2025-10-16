'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPoolInfo, getTotalTvl, getDepositorCount } from '@/services/contractService';

export const ContractTest: React.FC = () => {
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const testContracts = async () => {
    setIsLoading(true);
    try {
      const [poolInfo, vaultTvl, depositorCount] = await Promise.all([
        getPoolInfo(),
        getTotalTvl(),
        getDepositorCount(),
      ]);

      setResults({
        poolInfo,
        vaultTvl,
        depositorCount,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Contract test failed:', error);
      setResults({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Contract Integration Test
          <Badge variant="secondary">Testnet</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={testContracts} disabled={isLoading}>
          {isLoading ? 'Testing...' : 'Test Live Contracts'}
        </Button>

        {results && (
          <div className="space-y-2">
            <h4 className="font-semibold">Results:</h4>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
