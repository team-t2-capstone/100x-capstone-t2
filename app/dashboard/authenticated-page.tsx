'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RequireAuth } from '@/components/auth/protected-route';
import { useAuth } from '@/contexts/auth-context';
import { MessageSquare, Users, Zap, TrendingUp, Plus } from 'lucide-react';
import Link from 'next/link';

function DashboardContent() {
  const { user } = useAuth();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.full_name || 'User'}!
        </h1>
        <p className="text-gray-600">
          Here's what's happening with your AI clones today.
        </p>
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-medium text-green-800 mb-2">🎉 Authentication Success!</h3>
          <p className="text-sm text-green-700">
            You are successfully authenticated with CloneAI. Your frontend is now connected to the backend API.
          </p>
          <div className="mt-2 text-xs text-green-600">
            <p>User ID: {user?.id}</p>
            <p>Email: {user?.email}</p>
            <p>Role: {user?.role}</p>
            <p>Email Confirmed: {user?.email_confirmed ? 'Yes' : 'No'}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Clones</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              +2 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversations</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">127</div>
            <p className="text-xs text-muted-foreground">
              +12% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Remaining</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{user?.credits_remaining || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">
              {user?.subscription_tier || 'Free'} plan
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Usage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">84%</div>
            <p className="text-xs text-muted-foreground">
              +8% from last week
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Conversations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Conversations</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sessions">View all</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Business Coach Sarah', message: 'Thanks for the strategic planning session...', time: '2h ago' },
                { name: 'Tech Mentor Alex', message: 'Your code architecture looks solid...', time: '1d ago' },
                { name: 'Marketing Expert Lisa', message: 'Let\'s discuss your campaign strategy...', time: '2d ago' },
              ].map((conv, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {conv.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {conv.name}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {conv.message}
                    </p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {conv.time}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* My AI Clones */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My AI Clones</CardTitle>
            <Button size="sm" asChild>
              <Link href="/create-clone">
                <Plus className="h-4 w-4 mr-2" />
                Create Clone
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { name: 'Business Coach Sarah', specialty: 'Strategy & Leadership', conversations: 156, status: 'active' },
                { name: 'Tech Mentor Alex', specialty: 'Software Development', conversations: 89, status: 'active' },
                { name: 'Marketing Expert Lisa', specialty: 'Digital Marketing', conversations: 67, status: 'training' },
              ].map((clone, index) => (
                <div key={index} className="flex items-center space-x-4">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {clone.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {clone.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {clone.specialty} • {clone.conversations} conversations
                    </p>
                  </div>
                  <Badge 
                    variant={clone.status === 'active' ? 'default' : 'secondary'}
                    className="capitalize"
                  >
                    {clone.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AuthenticatedDashboard() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  );
}