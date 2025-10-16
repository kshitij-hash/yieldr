'use client';

import React from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProtocolCard } from './ProtocolCard';
import { YieldCharts } from './YieldCharts';
import { LivePoolStats } from './LivePoolStats';
import { useLiveYields } from '@/hooks/useLiveYields';

export const YieldDashboard: React.FC = () => {
  const { yields, isLoading, error, lastUpdated, refetch, sortedByApy } = useLiveYields();

  // Format last updated time
  const formatLastUpdated = (date: Date | null) => {
    if (!date) return 'Never';

    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Loading state
  if (isLoading && yields.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && yields.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {error} - Please try again later or check your connection.
        </AlertDescription>
      </Alert>
    );
  }

  const sortedYields = sortedByApy();

  return (
    <div className="space-y-6">
      {/* Live Pool Statistics */}
      <LivePoolStats />
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Yield Opportunities</h2>
          <p className="text-muted-foreground">
            Discover the best sBTC yields across DeFi protocols
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>{formatLastUpdated(lastUpdated)}</span>
          </div>
          <Button onClick={refetch} disabled={isLoading} size="sm" variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Highest APY</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {sortedYields[0]?.apy.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {sortedYields[0]?.protocol} - {sortedYields[0]?.poolName}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total TVL</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${yields.reduce((sum, y) => sum + y.tvl, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {yields.length} opportunities
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Average APY</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(yields.reduce((sum, y) => sum + y.apy, 0) / yields.length).toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Mean across all protocols
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Protocol Cards */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Protocols</h3>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {sortedYields.map((opportunity, index) => (
            <ProtocolCard key={index} opportunity={opportunity} />
          ))}
        </div>
      </div>

      {/* Charts */}
      {yields.length > 0 && <YieldCharts opportunities={yields} />}
    </div>
  );
};
