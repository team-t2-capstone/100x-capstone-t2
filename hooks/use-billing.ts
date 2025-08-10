/**
 * Billing Management Hook
 * Custom hook for managing billing data, payment methods, and subscriptions
 */
import { useState, useEffect, useCallback } from 'react';
import { useBilling } from './use-dashboard';

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal' | 'bank_account';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isPrimary: boolean;
  isDefault: boolean;
}

export interface BillingTransaction {
  id: string;
  amount: number;
  currency: string;
  description: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  createdAt: string;
  paymentMethod: string;
  invoiceUrl?: string;
}

export interface Subscription {
  id: string;
  plan: string;
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  cancelAtPeriodEnd: boolean;
}

export interface BillingData {
  totalSpent: number;
  currentBalance: number;
  subscription?: Subscription;
  paymentMethods: PaymentMethod[];
  recentTransactions: BillingTransaction[];
  upcomingPayments: Array<{
    amount: number;
    date: string;
    description: string;
  }>;
}

export function useAdvancedBilling(userId: string) {
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the basic billing hook from dashboard
  const {
    billingInfo,
    billingHistory,
    updatePaymentMethod,
    refresh
  } = useBilling(userId);

  const fetchBillingData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      // Fetch billing info from Supabase
      const { supabase } = await import('@/lib/supabase');
      // Get user profile billing info
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('total_spent,subscription_tier,credits_remaining,currency')
        .eq('id', userId)
        .single();
      if (userError) throw userError;
      // Get recent session transactions
      const { data: sessions, error: sessionError } = await supabase
        .from('sessions')
        .select('id,total_cost,rate_per_minute,duration_minutes,created_at,user_rating')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (sessionError) throw sessionError;
      // Compose billing data
      const billingData: BillingData = {
        totalSpent: userProfile?.total_spent || 0,
        currentBalance: userProfile?.credits_remaining || 0,
        subscription: {
          id: userId,
          plan: userProfile?.subscription_tier || 'free',
          status: 'active',
          currentPeriodStart: '',
          currentPeriodEnd: '',
          amount: 0,
          currency: userProfile?.currency || 'USD',
          interval: 'month',
          cancelAtPeriodEnd: false,
        },
        paymentMethods: [], // Not tracked in schema
        recentTransactions: (sessions || []).map((s: any) => ({
          id: s.id,
          amount: s.total_cost,
          currency: userProfile?.currency || 'USD',
          description: `Session on ${s.created_at}`,
          status: 'completed',
          createdAt: s.created_at,
          paymentMethod: '',
          invoiceUrl: '',
        })),
        upcomingPayments: [], // Not tracked in schema
      };
      setBillingData(billingData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addPaymentMethod = useCallback(async (paymentMethodData: any) => {
    try {
      setError(null);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Update billing data
      await fetchBillingData();
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add payment method');
      return false;
    }
  }, [fetchBillingData]);

  const removePaymentMethod = useCallback(async (paymentMethodId: string) => {
    try {
      setError(null);
      
      // Can't remove the only/primary payment method
      const currentMethods = billingData?.paymentMethods || [];
      if (currentMethods.length <= 1) {
        setError('Cannot remove the only payment method');
        return false;
      }
      
      const methodToRemove = currentMethods.find(pm => pm.id === paymentMethodId);
      if (methodToRemove?.isPrimary) {
        setError('Cannot remove primary payment method. Set another as primary first.');
        return false;
      }
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update billing data
      await fetchBillingData();
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove payment method');
      return false;
    }
  }, [billingData?.paymentMethods, fetchBillingData]);

  const setPrimaryPaymentMethod = useCallback(async (paymentMethodId: string) => {
    try {
      setError(null);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Update billing data
      await fetchBillingData();
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update primary payment method');
      return false;
    }
  }, [fetchBillingData]);

  const cancelSubscription = useCallback(async (cancelAtPeriodEnd: boolean = true) => {
    try {
      setError(null);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update billing data
      await fetchBillingData();
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
      return false;
    }
  }, [fetchBillingData]);

  const updateSubscription = useCallback(async (planId: string) => {
    try {
      setError(null);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update billing data
      await fetchBillingData();
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update subscription');
      return false;
    }
  }, [fetchBillingData]);

  const downloadInvoice = useCallback(async (transactionId: string) => {
    try {
      setError(null);
      
      const transaction = billingData?.recentTransactions.find(t => t.id === transactionId);
      if (!transaction || !transaction.invoiceUrl) {
        setError('Invoice not found');
        return false;
      }
      
      // Simulate download
      window.open(transaction.invoiceUrl, '_blank');
      return true;
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download invoice');
      return false;
    }
  }, [billingData?.recentTransactions]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  return {
    billingData,
    loading,
    error,
    addPaymentMethod,
    removePaymentMethod,
    setPrimaryPaymentMethod,
    cancelSubscription,
    updateSubscription,
    downloadInvoice,
    refresh: fetchBillingData,
  };
}