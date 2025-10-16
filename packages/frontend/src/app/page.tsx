"use client";

import React, { useState } from "react";
import { YieldDashboard } from "@/components/dashboard/YieldDashboard";
import { AIRecommendation } from "@/components/recommendations/AIRecommendation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { useRecommendation } from "@/hooks/useRecommendation";
import { useWallet } from "@/contexts/WalletContext";

export default function HomePage() {
  const { isConnected, connect } = useWallet();
  const { recommendation, isLoading, error, fetchRecommendation } =
    useRecommendation();
  const [amount, setAmount] = useState(1);
  const [riskTolerance, setRiskTolerance] = useState<
    "conservative" | "moderate" | "aggressive"
  >("moderate");

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
      <div className="relative overflow-hidden rounded-xl md:rounded-2xl bg-gradient-to-br from-primary/10 via-secondary/10 to-background p-6 md:p-8 lg:p-12 animate-fade-in">
        <div className="absolute inset-0 bg-grid-white/[0.02] -z-10" />
        <div className="space-y-3 md:space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 animate-scale-in">
            <Sparkles className="h-3 w-3 md:h-4 md:w-4 text-primary" />
            <span className="text-xs md:text-sm font-medium text-primary">
              Bitcoin DeFi, Simplified by AI
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Welcome to yieldr
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl">
            Maximize your sBTC returns with AI-powered yield optimization on
            Stacks blockchain
          </p>
          {!isConnected && (
            <div className="pt-2 md:pt-4">
              <Button size="lg" className="gap-2 w-full sm:w-auto" onClick={() => connect()}>
                Get Started
                <Sparkles className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
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
                <Select
                  value={riskTolerance}
                  onValueChange={(v) =>
                    setRiskTolerance(
                      v as "conservative" | "moderate" | "aggressive"
                    )
                  }
                >
                  <SelectTrigger id="risk">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="conservative">
                      Conservative - Low Risk
                    </SelectItem>
                    <SelectItem value="moderate">
                      Moderate - Balanced Risk
                    </SelectItem>
                    <SelectItem value="aggressive">
                      Aggressive - High Risk
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleGetRecommendation}
              disabled={isLoading}
              className="w-full"
            >
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

      {/* Empty State for Non-Connected Users */}
      {!isConnected && (
        <Card className="animate-fade-in-up">
          <CardHeader>
            <CardTitle className="text-center">How yieldr Works</CardTitle>
            <CardDescription className="text-center">
              Three simple steps to optimize your sBTC yields
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
              <div className="text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <h3 className="font-semibold text-base">Connect Wallet</h3>
                <p className="text-sm text-muted-foreground">
                  Connect your Stacks wallet (Leather or Xverse) to get started
                </p>
              </div>
              <div className="text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <h3 className="font-semibold text-base">Get AI Recommendations</h3>
                <p className="text-sm text-muted-foreground">
                  Our AI analyzes your preferences and suggests optimal yield
                  strategies
                </p>
              </div>
              <div className="text-center space-y-3 sm:col-span-2 md:col-span-1">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <h3 className="font-semibold text-base">Deposit & Earn</h3>
                <p className="text-sm text-muted-foreground">
                  Deposit your sBTC and watch your yields grow automatically
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Yield Dashboard */}
      <YieldDashboard />
    </div>
  );
}
