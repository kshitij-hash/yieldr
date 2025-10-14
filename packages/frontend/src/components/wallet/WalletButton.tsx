'use client';

import React from 'react';
import { Wallet, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useWallet } from '@/contexts/WalletContext';

export const WalletButton: React.FC = () => {
  const { isConnected, address, stxBalance, sbtcBalance, connect, disconnect, refreshBalances, isLoading } = useWallet();

  // Truncate address for display
  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (!isConnected) {
    return (
      <Button onClick={connect} disabled={isLoading}>
        <Wallet className="mr-2 h-4 w-4" />
        Connect Wallet
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Wallet className="mr-2 h-4 w-4" />
          {address ? truncateAddress(address) : 'Connected'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Wallet</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="px-2 py-2 text-sm">
          <p className="font-medium mb-1">Address</p>
          <p className="text-muted-foreground font-mono text-xs break-all">{address}</p>
        </div>
        <DropdownMenuSeparator />
        <div className="px-2 py-2 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">STX Balance:</span>
            <span className="font-medium">{stxBalance.toFixed(2)} STX</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">sBTC Balance:</span>
            <span className="font-medium">{sbtcBalance.toFixed(4)} sBTC</span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={refreshBalances}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Balances
        </DropdownMenuItem>
        <DropdownMenuItem onClick={disconnect}>
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
