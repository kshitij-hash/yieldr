"use client";

import React from "react";
import { VaultInterface } from "@/components/vault/VaultInterface";

export default function VaultPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-3 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Vault</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Securely manage your sBTC deposits and withdrawals with our
          battle-tested smart contract
        </p>
      </div>

      <VaultInterface />
    </div>
  );
}
