"use client"

import { useState, useEffect } from "react"
import { useAuth } from '@/contexts/auth-context'
import { createClient } from '@/utils/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CreditCard, DollarSign, TrendingUp, Calendar, AlertCircle, Download } from "lucide-react"

interface BillingData {
  totalSpent: number
  creditsRemaining: number
  subscriptionTier: string
  recentSessions: Array<{
    id: string
    total_cost: number
    duration_minutes: number
    created_at: string
    clone_name: string
    rate_per_minute: number
  }>
  monthlySpending: Array<{
    month: string
    amount: number
  }>
}

export default function BillingPage() {
  const { user } = useAuth()
  const [billingData, setBillingData] = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchBillingData() {
      if (!user?.id) return

      try {
        setLoading(true)
        setError(null)

        // Get user profile for billing summary
        const supabase = createClient()
        const { data: userProfile, error: userError } = await supabase
          .from('user_profiles')
          .select('total_spent, credits_remaining, subscription_tier')
          .eq('id', user.id)
          .single()

        if (userError) throw userError

        // Get recent sessions with clone information
        const { data: sessions, error: sessionsError } = await supabase
          .from('sessions')
          .select(`
            id,
            total_cost,
            duration_minutes,
            created_at,
            rate_per_minute,
            clones!sessions_clone_id_fkey(name)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20)

        if (sessionsError) throw sessionsError

        // Calculate monthly spending
        const monthlySpending = sessions?.reduce((acc: any[], session: any) => {
          const month = new Date(session.created_at).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long' 
          })
          const existing = acc.find(item => item.month === month)
          if (existing) {
            existing.amount += session.total_cost || 0
          } else {
            acc.push({ month, amount: session.total_cost || 0 })
          }
          return acc
        }, []) || []

        setBillingData({
          totalSpent: userProfile?.total_spent || 0,
          creditsRemaining: userProfile?.credits_remaining || 0,
          subscriptionTier: userProfile?.subscription_tier || 'free',
          recentSessions: (sessions || []).map((session: any) => ({
            id: session.id,
            total_cost: session.total_cost || 0,
            duration_minutes: session.duration_minutes || 0,
            created_at: session.created_at,
            clone_name: session.clones?.name || 'Unknown Clone',
            rate_per_minute: session.rate_per_minute || 0
          })),
          monthlySpending: monthlySpending.slice(0, 6) // Last 6 months
        })

      } catch (err) {
        console.error('Error fetching billing data:', err)
        setError(err instanceof Error ? err.message : 'Failed to load billing data')
      } finally {
        setLoading(false)
      }
    }

    fetchBillingData()
  }, [user?.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading billing information...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">Billing & Usage</h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">Track your spending and manage your account</p>
        </div>

        {/* Billing Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(billingData?.totalSpent || 0)}</div>
              <p className="text-xs text-muted-foreground">All-time spending</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credits Remaining</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{billingData?.creditsRemaining || 0}</div>
              <p className="text-xs text-muted-foreground">Available credits</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subscription</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">{billingData?.subscriptionTier || 'Free'}</div>
              <Badge variant="secondary" className="mt-1">
                {billingData?.subscriptionTier === 'free' ? 'Basic Plan' : 'Premium Plan'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Spending Chart */}
        {billingData?.monthlySpending && billingData.monthlySpending.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Spending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {billingData.monthlySpending.map((month, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{month.month}</span>
                    <span className="font-bold">{formatCurrency(month.amount)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Sessions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recent Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!billingData?.recentSessions?.length ? (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No sessions yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {billingData.recentSessions.map((session) => (
                  <div key={session.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2 sm:space-y-0">
                    <div>
                      <p className="font-medium">{session.clone_name}</p>
                      <p className="text-sm text-slate-500">
                        {formatDate(session.created_at)} • {session.duration_minutes} minutes
                      </p>
                      <p className="text-xs text-slate-400">
                        Rate: {formatCurrency(session.rate_per_minute)}/min
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-bold text-lg">{formatCurrency(session.total_cost)}</p>
                      <Badge variant="outline" className="text-xs">
                        Completed
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 mt-8">
          <Button variant="outline" className="bg-transparent">
            <Download className="h-4 w-4 mr-2" />
            Download Invoice
          </Button>
          <Button>
            Add Credits
          </Button>
          {billingData?.subscriptionTier === 'free' && (
            <Button variant="default">
              Upgrade to Premium
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
