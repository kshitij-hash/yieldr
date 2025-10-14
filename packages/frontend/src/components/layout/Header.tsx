'use client';

import React from 'react';
import Link from 'next/link';
import { Bitcoin, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { WalletButton } from '@/components/wallet/WalletButton';
import { useWallet } from '@/contexts/WalletContext';
import { useContract } from '@/hooks/useContract';
import { SidebarTrigger } from '@/components/ui/sidebar';

export const Header: React.FC = () => {
  const { network } = useWallet();
  const { isPaused } = useContract();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4">
        {/* Left side - Logo and Sidebar Trigger */}
        <div className="flex items-center gap-4">
          <SidebarTrigger className="md:hidden" />

          <Link href="/" className="flex items-center space-x-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
              <Bitcoin className="h-5 w-5" />
            </div>
            <span className="hidden font-bold text-xl sm:inline-block">
              BitYield
            </span>
          </Link>

          {/* Network Badge */}
          <Badge variant={network === 'mainnet' ? 'default' : 'secondary'} className="hidden sm:flex">
            {network === 'mainnet' ? 'Mainnet' : 'Testnet'}
          </Badge>

          {/* Pause Status Indicator */}
          {isPaused && (
            <Badge variant="destructive" className="hidden md:flex gap-1">
              <AlertCircle className="h-3 w-3" />
              Paused
            </Badge>
          )}
        </div>

        {/* Right side - Wallet Button */}
        <div className="flex items-center gap-4">
          <WalletButton />
        </div>
      </div>
    </header>
  );
};
