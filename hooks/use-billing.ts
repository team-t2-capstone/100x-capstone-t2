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

// Mock billing data - in production this would come from Stripe/payment processor
const mockBillingData: BillingData = {
  totalSpent: 1247.50,
  currentBalance: -12.50, // Negative means amount owed
  subscription: {
    id: 'sub_1234567890',
    plan: 'Premium Plan',
    status: 'active',
    currentPeriodStart: '2024-12-01T00:00:00Z',
    currentPeriodEnd: '2025-01-01T00:00:00Z',
    amount: 29.99,
    currency: 'USD',
    interval: 'month',
    cancelAtPeriodEnd: false,
  },
  paymentMethods: [
    {
      id: 'pm_1234567890',
      type: 'card',
      last4: '4242',
      brand: 'visa',
      expiryMonth: 12,
      expiryYear: 2025,
      isPrimary: true,
      isDefault: true,
    },
    {
      id: 'pm_0987654321',
      type: 'card',
      last4: '1234',
      brand: 'mastercard',
      expiryMonth: 8,
      expiryYear: 2026,
      isPrimary: false,
      isDefault: false,
    },
  ],
  recentTransactions: [
    {
      id: 'txn_001',
      amount: 487.50,
      currency: 'USD',
      description: 'December 2024 - Sessions and subscriptions',
      status: 'completed',
      createdAt: '2024-12-01T00:00:00Z',
      paymentMethod: 'Visa ending in 4242',
      invoiceUrl: '/billing/invoice/txn_001',
    },
    {
      id: 'txn_002',
      amount: 325.00,
      currency: 'USD',
      description: 'November 2024 - Sessions and subscriptions',
      status: 'completed',
      createdAt: '2024-11-01T00:00:00Z',
      paymentMethod: 'Visa ending in 4242',
      invoiceUrl: '/billing/invoice/txn_002',
    },
    {
      id: 'txn_003',
      amount: 412.75,
      currency: 'USD',
      description: 'October 2024 - Sessions and subscriptions',
      status: 'completed',
      createdAt: '2024-10-01T00:00:00Z',
      paymentMethod: 'Visa ending in 4242',
      invoiceUrl: '/billing/invoice/txn_003',
    },
  ],
  upcomingPayments: [
    {
      amount: 29.99,
      date: '2025-01-01',
      description: 'Premium Plan Subscription',
    },
  ],
};

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
      
      // In production, this would be real API calls
      // For now, simulate API delay and return mock data
      await new Promise(resolve => setTimeout(resolve, 1000));
      setBillingData(mockBillingData);
      
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