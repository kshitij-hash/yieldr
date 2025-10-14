'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useWallet } from '@/contexts/WalletContext';
import { depositSbtc, getExplorerUrl } from '@/services/contractService';
import { toast } from 'sonner';

// Form validation schema
const formSchema = z.object({
  amount: z
    .number()
    .min(0.1, { message: 'Minimum deposit is 0.1 sBTC' })
    .max(1000, { message: 'Maximum deposit is 1000 sBTC' }),
});

export const DepositForm: React.FC = () => {
  const { sbtcBalance, refreshBalances } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0.1,
    },
  });

  // Set preset percentages
  const setPreset = (percentage: number) => {
    const amount = (sbtcBalance * percentage) / 100;
    form.setValue('amount', Math.max(0.1, Math.min(amount, 1000)));
  };

  // Handle form submission
  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (values.amount > sbtcBalance) {
      toast.error('Insufficient sBTC balance');
      return;
    }

    setIsSubmitting(true);

    try {
      await depositSbtc(
        values.amount,
        (data) => {
          toast.success('Deposit transaction submitted!', {
            description: `Transaction ID: ${data.txId.slice(0, 8)}...`,
            action: {
              label: 'View',
              onClick: () => window.open(getExplorerUrl(data.txId), '_blank'),
            },
          });

          form.reset();
          refreshBalances();
          setIsSubmitting(false);
        },
        () => {
          toast.error('Transaction cancelled');
          setIsSubmitting(false);
        }
      );
    } catch (error) {
      console.error('Deposit error:', error);
      toast.error('Failed to submit deposit transaction');
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>sBTC Amount</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  step="0.0001"
                  placeholder="0.1"
                  {...field}
                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormDescription>
                Available: {sbtcBalance.toFixed(4)} sBTC
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Preset buttons */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreset(25)}
            disabled={isSubmitting}
          >
            25%
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreset(50)}
            disabled={isSubmitting}
          >
            50%
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreset(75)}
            disabled={isSubmitting}
          >
            75%
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPreset(100)}
            disabled={isSubmitting}
          >
            MAX
          </Button>
        </div>

        {/* Slider */}
        <div className="space-y-2">
          <FormLabel>Amount Slider</FormLabel>
          <Slider
            min={0.1}
            max={Math.min(sbtcBalance, 1000)}
            step={0.01}
            value={[form.watch('amount')]}
            onValueChange={([value]) => form.setValue('amount', value)}
            disabled={isSubmitting}
          />
        </div>

        {/* Submit button */}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <ArrowDown className="mr-2 h-4 w-4" />
              Deposit sBTC
            </>
          )}
        </Button>
      </form>
    </Form>
  );
};
