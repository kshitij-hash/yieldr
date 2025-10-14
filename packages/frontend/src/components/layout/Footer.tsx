'use client';

import React from 'react';
import Link from 'next/link';
import { Github, Twitter, MessageCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t bg-background">
      <div className="container py-8 px-4">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* About */}
          <div>
            <h3 className="text-lg font-semibold mb-3">BitYield</h3>
            <p className="text-sm text-muted-foreground">
              AI-powered sBTC yield optimization on the Stacks blockchain.
              Maximize your returns with intelligent DeFi strategies.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground">
                  Documentation
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/bityield"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  GitHub
                </a>
              </li>
              <li>
                <Link href="/about" className="text-sm text-muted-foreground hover:text-foreground">
                  About
                </Link>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Community</h3>
            <div className="flex gap-4">
              <a
                href="https://github.com/bityield"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com/bityield"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="https://discord.gg/bityield"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground"
              >
                <MessageCircle className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            Built on Stacks • Secured by Bitcoin
          </p>
          <p className="text-xs text-muted-foreground">
            © 2024 BitYield. All rights reserved. |
            <Link href="/terms" className="ml-2 hover:text-foreground">Terms</Link> |
            <Link href="/privacy" className="ml-2 hover:text-foreground">Privacy</Link>
          </p>
        </div>

        <div className="mt-4">
          <p className="text-xs text-muted-foreground">
            ⚠️ Disclaimer: DeFi investments carry risks. Smart contracts are unaudited. Use at your own risk.
          </p>
        </div>
      </div>
    </footer>
  );
};
