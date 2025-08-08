"use client"

import { useState } from "react"
import { useAuth } from '@/contexts/auth-context'
import { useUserProfile } from '@/hooks/use-dashboard'
import { useAdvancedBilling } from '@/hooks/use-billing'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bell, Shield, CreditCard, Camera, Save, Edit, Trash2, Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"

export default function ProfilePage() {
  const { user } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  
  const {
    profile,
    loading,
    error,
    updating,
    updateProfile,
    updatePreferences,
    refresh
  } = useUserProfile(user?.id || '')
  
  const {
    billingData,
    loading: billingLoading,
    error: billingError,
    addPaymentMethod,
    removePaymentMethod,
    setPrimaryPaymentMethod,
    downloadInvoice
  } = useAdvancedBilling(user?.id || '')
  
  // Local state for form data
  const [profileData, setProfileData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    bio: "",
    dateOfBirth: "",
    timezone: "America/Los_Angeles",
    avatar: "/placeholder.svg?height=120&width=120",
  })
  
  // Update local state when profile data loads
  useState(() => {
    if (profile && !isEditing) {
      setProfileData({
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        email: profile.email || "",
        phone: profile.phone || "",
        location: profile.location || "",
        bio: profile.bio || "",
        dateOfBirth: profile.dateOfBirth || "",
        timezone: profile.timezone || "America/Los_Angeles",
        avatar: profile.avatar || "/placeholder.svg?height=120&width=120",
      })
    }
  }, [profile, isEditing])

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: true,
    sessionReminders: true,
    marketingEmails: false,
    weeklyDigest: true,
    darkMode: false,
    language: "en",
    currency: "USD",
  })
  
  // Update preferences when profile loads
  useState(() => {
    if (profile?.preferences) {
      setPreferences({
        emailNotifications: profile.preferences.emailNotifications ?? true,
        pushNotifications: profile.preferences.pushNotifications ?? true,
        sessionReminders: profile.preferences.sessionReminders ?? true,
        marketingEmails: profile.preferences.marketingEmails ?? false,
        weeklyDigest: profile.preferences.weeklyDigest ?? true,
        darkMode: profile.preferences.darkMode ?? false,
        language: profile.preferences.language ?? "en",
        currency: profile.preferences.currency ?? "USD",
      })
    }
  }, [profile?.preferences])
  
  const handleUpdatePreferences = async (newPreferences: any) => {
    setPreferences(newPreferences)
    await updatePreferences(newPreferences)
  }
  
  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading profile...</span>
        </div>
      </div>
    )
  }
  
  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
        <Alert variant="destructive" className="max-w-md mx-auto">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button variant="outline" size="sm" className="mt-2 w-full" onClick={refresh}>
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    sessionTimeout: "30",
    loginAlerts: true,
  })

  const handleSaveProfile = async () => {
    const success = await updateProfile(profileData)
    if (success) {
      setIsEditing(false)
    }
  }

  const handleDeleteAccount = () => {
    // Delete account logic here
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      // Proceed with deletion
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2">Profile Settings</h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">Manage your account settings and preferences</p>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-8">
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="billing">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Personal Information</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditing(!isEditing)}
                    className="bg-transparent"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {isEditing ? "Cancel" : "Edit"}
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Avatar Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
                  <div className="relative">
                    <Avatar className="h-24 w-24 sm:h-32 sm:w-32">
                      <AvatarImage src={profileData.avatar || "/placeholder.svg"} alt="Profile picture" />
                      <AvatarFallback className="text-xl">
                        {profileData.firstName[0]}
                        {profileData.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    {isEditing && (
                      <Button size="sm" className="absolute bottom-0 right-0 rounded-full h-8 w-8 p-0">
                        <Camera className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {profileData.firstName} {profileData.lastName}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-300">{profileData.email}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="secondary">Premium Member</Badge>
                      <Badge variant="outline">Verified</Badge>
                    </div>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={profileData.firstName}
                      onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={profileData.lastName}
                      onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={profileData.location}
                      onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={profileData.dateOfBirth}
                      onChange={(e) => setProfileData({ ...profileData, dateOfBirth: e.target.value })}
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    disabled={!isEditing}
                    rows={4}
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={profileData.timezone}
                    onValueChange={(value) => setProfileData({ ...profileData, timezone: value })}
                    disabled={!isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="Europe/London">Greenwich Mean Time (GMT)</SelectItem>
                      <SelectItem value="Europe/Paris">Central European Time (CET)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Japan Standard Time (JST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {isEditing && (
                  <div className="flex flex-col sm:flex-row gap-4 pt-4">
                    <Button 
                      onClick={handleSaveProfile} 
                      className="flex-1 sm:flex-none"
                      disabled={updating}
                    >
                      {updating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 sm:flex-none bg-transparent"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bell className="h-5 w-5" />
                  <span>Notifications</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Receive notifications about sessions and updates via email
                    </p>
                  </div>
                  <Switch
                    checked={preferences.emailNotifications}
                    onCheckedChange={(checked) => handleUpdatePreferences({ ...preferences, emailNotifications: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Push Notifications</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Receive push notifications on your device
                    </p>
                  </div>
                  <Switch
                    checked={preferences.pushNotifications}
                    onCheckedChange={(checked) => handleUpdatePreferences({ ...preferences, pushNotifications: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Session Reminders</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Get reminded about upcoming sessions</p>
                  </div>
                  <Switch
                    checked={preferences.sessionReminders}
                    onCheckedChange={(checked) => handleUpdatePreferences({ ...preferences, sessionReminders: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Marketing Emails</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Receive promotional emails and special offers
                    </p>
                  </div>
                  <Switch
                    checked={preferences.marketingEmails}
                    onCheckedChange={(checked) => setPreferences({ ...preferences, marketingEmails: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Weekly Digest</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Get a weekly summary of your activity and recommendations
                    </p>
                  </div>
                  <Switch
                    checked={preferences.weeklyDigest}
                    onCheckedChange={(checked) => setPreferences({ ...preferences, weeklyDigest: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Display & Language</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Dark Mode</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-300">Use dark theme across the application</p>
                  </div>
                  <Switch
                    checked={preferences.darkMode}
                    onCheckedChange={(checked) => handleUpdatePreferences({ ...preferences, darkMode: checked })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select
                      value={preferences.language}
                      onValueChange={(value) => handleUpdatePreferences({ ...preferences, language: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="es">Español</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="ja">日本語</SelectItem>
                        <SelectItem value="zh">中文</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select
                      value={preferences.currency}
                      onValueChange={(value) => handleUpdatePreferences({ ...preferences, currency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="JPY">JPY (¥)</SelectItem>
                        <SelectItem value="CAD">CAD (C$)</SelectItem>
                        <SelectItem value="AUD">AUD (A$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Security Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Two-Factor Authentication</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Add an extra layer of security to your account
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings.twoFactorAuth}
                    onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, twoFactorAuth: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Login Alerts</Label>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Get notified when someone logs into your account
                    </p>
                  </div>
                  <Switch
                    checked={securitySettings.loginAlerts}
                    onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, loginAlerts: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Session Timeout</Label>
                  <Select
                    value={securitySettings.sessionTimeout}
                    onValueChange={(value) => setSecuritySettings({ ...securitySettings, sessionTimeout: value })}
                  >
                    <SelectTrigger className="w-full md:w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                      <SelectItem value="never">Never</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Automatically log out after period of inactivity
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button variant="outline" className="bg-transparent">
                    Change Password
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-slate-900 dark:text-white mb-2">Delete Account</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                    <Button variant="destructive" onClick={handleDeleteAccount}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Payment Methods</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {billingLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading payment methods...</span>
                  </div>
                ) : !billingData?.paymentMethods.length ? (
                  <div className="text-center py-8 text-slate-500">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No payment methods added</p>
                  </div>
                ) : (
                  billingData.paymentMethods.map((pm) => (
                    <div key={pm.id} className="flex items-center space-x-3 p-4 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <CreditCard className="h-8 w-8 text-slate-400" />
                      <div className="flex-1">
                        <p className="font-medium">
                          {pm.brand?.toUpperCase()} •••• {pm.last4}
                        </p>
                        <p className="text-sm text-slate-500">
                          Expires {pm.expiryMonth?.toString().padStart(2, '0')}/{pm.expiryYear?.toString().slice(-2)}
                        </p>
                      </div>
                      {pm.isPrimary && <Badge>Primary</Badge>}
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
                <Button variant="outline" className="w-full bg-transparent">
                  Add Payment Method
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Billing History</CardTitle>
              </CardHeader>
              <CardContent>
                {billingLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading billing history...</span>
                  </div>
                ) : billingError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{billingError}</AlertDescription>
                  </Alert>
                ) : !billingData?.recentTransactions.length ? (
                  <div className="text-center py-8 text-slate-500">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No billing history yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {billingData.recentTransactions.map((transaction) => (
                      <div key={transaction.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2 sm:space-y-0">
                        <div>
                          <p className="font-medium">{new Date(transaction.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</p>
                          <p className="text-sm text-slate-500">{transaction.description}</p>
                          <p className="text-xs text-slate-400">{transaction.paymentMethod}</p>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="font-medium">${transaction.amount.toFixed(2)}</p>
                          <div className="flex items-center space-x-2">
                            <Badge 
                              variant={transaction.status === 'completed' ? 'default' : transaction.status === 'failed' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {transaction.status}
                            </Badge>
                            {transaction.invoiceUrl && (
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="p-0 h-auto"
                                onClick={() => downloadInvoice(transaction.id)}
                              >
                                Download
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Subscription</CardTitle>
              </CardHeader>
              <CardContent>
                {billingLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Loading subscription...</span>
                  </div>
                ) : !billingData?.subscription ? (
                  <div className="text-center py-8 text-slate-500">
                    <CreditCard className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No active subscription</p>
                    <Button className="mt-4">
                      Subscribe to Premium
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-slate-900 dark:text-white">{billingData.subscription.plan}</h4>
                          <Badge 
                            variant={billingData.subscription.status === 'active' ? 'default' : 'secondary'}
                          >
                            {billingData.subscription.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Unlimited sessions with featured experts
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          Next billing: {new Date(billingData.subscription.currentPeriodEnd).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-left sm:text-right">
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">
                          ${billingData.subscription.amount.toFixed(2)}
                        </p>
                        <p className="text-sm text-slate-500">
                          per {billingData.subscription.interval}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button variant="outline" className="bg-transparent">
                        Change Plan
                      </Button>
                      <Button variant="ghost">
                        {billingData.subscription.cancelAtPeriodEnd ? 'Reactivate' : 'Cancel'} Subscription
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
