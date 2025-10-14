'use client';

import React, { useState } from 'react';
import { YieldDashboard } from '@/components/dashboard/YieldDashboard';
import { AIRecommendation } from '@/components/recommendations/AIRecommendation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles } from 'lucide-react';
import { useRecommendation } from '@/hooks/useRecommendation';
import { useWallet } from '@/contexts/WalletContext';

export default function HomePage() {
  const { isConnected } = useWallet();
  const { recommendation, isLoading, error, fetchRecommendation } = useRecommendation();
  const [amount, setAmount] = useState(1);
  const [riskTolerance, setRiskTolerance] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');

  const handleGetRecommendation = () => {
    fetchRecommendation({
      amount,
      riskTolerance,
      avoidImpermanentLoss: true,
    });
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">
          Welcome to BitYield
        </h1>
        <p className="text-xl text-muted-foreground">
          AI-powered sBTC yield optimization on Stacks
        </p>
      </div>

      {/* AI Recommendation Section */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Get AI Recommendation
            </CardTitle>
            <CardDescription>
              Tell us your preferences and get a personalized yield strategy
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="amount">sBTC Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.1"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  placeholder="1.0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk">Risk Tolerance</Label>
                <Select value={riskTolerance} onValueChange={(v) => setRiskTolerance(v as 'conservative' | 'moderate' | 'aggressive')}>
                  <SelectTrigger id="risk">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">Conservative - Low Risk</SelectItem>
                    <SelectItem value="moderate">Moderate - Balanced Risk</SelectItem>
                    <SelectItem value="aggressive">Aggressive - High Risk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleGetRecommendation} disabled={isLoading} className="w-full">
              <Sparkles className="mr-2 h-4 w-4" />
              Get Recommendation
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Show Recommendation if available */}
      {(recommendation || isLoading || error) && (
        <AIRecommendation
          recommendation={recommendation}
          isLoading={isLoading}
          error={error}
          amount={amount}
        />
      )}

      {/* Yield Dashboard */}
      <YieldDashboard />
    </div>
  );
}
