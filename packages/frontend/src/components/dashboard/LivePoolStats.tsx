'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, DollarSign, Users, Activity } from 'lucide-react';
// import { getPoolInfo, getTotalTvl, getDepositorCount } from '@/services/contractService'; // Will enable once contracts are initialized

interface PoolStats {
  apy: number;
  poolTvl: number;
  vaultTvl: number;
  depositorCount: number;
  isLoading: boolean;
}

export const LivePoolStats: React.FC = () => {
  const [stats, setStats] = useState<PoolStats>({
    apy: 0,
    poolTvl: 0,
    vaultTvl: 0,
    depositorCount: 0,
    isLoading: true,
  });

  const fetchStats = async () => {
    try {
      setStats(prev => ({ ...prev, isLoading: true }));
      
      // Get oracle data (this is working)
      const oracleResponse = await fetch('http://localhost:3001/api/oracle/mainnet-data');
      const oracleData = await oracleResponse.json();
      
      if (oracleData.success) {
        const mainnetData = oracleData.mainnetData;
        
        setStats({
          apy: mainnetData.apy.value,
          poolTvl: mainnetData.tvl.usd,
          vaultTvl: 0, // Will be populated once users start depositing
          depositorCount: 0, // Will be populated once users start depositing
          isLoading: false,
        });
      } else {
        throw new Error('Failed to fetch oracle data');
      }
    } catch (error) {
      console.error('Error fetching pool stats:', error);
      setStats(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const formatBTC = (value: number) => {
    return `${value.toFixed(4)} sBTC`;
  };

  if (stats.isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Live Pool Statistics</h2>
        <Badge variant="secondary" className="bg-green-100 text-green-800">
          <Activity className="w-3 h-3 mr-1" />
          Live Testnet
        </Badge>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Current APY */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current APY</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.apy.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Real-time from mainnet oracle
            </p>
          </CardContent>
        </Card>

        {/* Pool TVL */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pool TVL</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.poolTvl)}
            </div>
            <p className="text-xs text-muted-foreground">
              STX-sBTC Pool Total Value
            </p>
          </CardContent>
        </Card>

        {/* Vault TVL */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vault TVL</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBTC(stats.vaultTvl)}
            </div>
            <p className="text-xs text-muted-foreground">
              Total sBTC in vault
            </p>
          </CardContent>
        </Card>

        {/* Depositor Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.depositorCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Total depositors
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
