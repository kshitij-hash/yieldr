'use client';

import React from 'react';
import { VaultInterface } from '@/components/vault/VaultInterface';

export default function VaultPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Vault</h1>
        <p className="text-muted-foreground">
          Manage your sBTC deposits and withdrawals
        </p>
      </div>

      <VaultInterface />
    </div>
  );
}
