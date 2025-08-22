"use client"

import { useState } from "react"
import { useAuth } from '@/contexts/auth-context'
import { useUserProfile } from '@/hooks/use-dashboard'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Bell, Globe, Shield, Palette, Save, Loader2, AlertCircle } from "lucide-react"

export default function SettingsClient() {
  const { user } = useAuth()
  const {
    profile,
    loading,
    error,
    updating,
    updatePreferences,
    refresh
  } = useUserProfile(user?.id || '')
  
  const [activeTab, setActiveTab] = useState("account")
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  
  // Form state
  const [formState, setFormState] = useState({
    name: profile?.full_name || '',
    email: profile?.email || '',
    language: profile?.language || 'en',
    timezone: profile?.timezone || 'UTC',
    darkMode: profile?.preferences?.darkMode || false,
    notifications: {
      email: profile?.preferences?.notifications?.email || false,
      marketing: profile?.preferences?.notifications?.marketing || false,
      security: profile?.preferences?.notifications?.security || true,
    }
  })
  
  // Update form when profile loads
  if (profile && !loading && formState.name === '' && profile.full_name) {
    setFormState({
      name: profile.full_name || '',
      email: profile.email || '',
      language: profile.language || 'en',
      timezone: profile.timezone || 'UTC',
      darkMode: profile.preferences?.darkMode || false,
      notifications: {
        email: profile.preferences?.notifications?.email || false,
        marketing: profile.preferences?.notifications?.marketing || false,
        security: profile.preferences?.notifications?.security || true,
      }
    })
  }
  
  const handleSave = async () => {
    try {
      setSaveSuccess(false)
      setSaveError(null)
      
      // Update preferences in the profile
      const success = await updatePreferences({
        darkMode: formState.darkMode,
        notifications: formState.notifications
      })
      
      if (success) {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        setSaveError("Failed to save preferences")
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "An error occurred")
    }
  }
  
  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Error loading profile: {error}
          </AlertDescription>
        </Alert>
      </div>
    )
  }
  
  return (
    <div className="container mx-auto py-10">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">
            Manage your account settings and preferences.
          </p>
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="account">
              <Shield className="h-4 w-4 mr-2" />
              Account
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <Palette className="h-4 w-4 mr-2" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="display">
              <Globe className="h-4 w-4 mr-2" />
              Display
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="account" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input 
                    id="name" 
                    value={formState.name} 
                    onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                    disabled
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    value={formState.email} 
                    onChange={(e) => setFormState(prev => ({ ...prev, email: e.target.value }))}
                    disabled
                  />
                  <p className="text-sm text-muted-foreground">
                    Email changes must be done through account verification.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="appearance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="dark-mode">Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Enable dark mode for the application.
                    </p>
                  </div>
                  <Switch 
                    id="dark-mode" 
                    checked={formState.darkMode}
                    onCheckedChange={(checked) => setFormState(prev => ({ ...prev, darkMode: checked }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Notification Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="email-notifications">Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email notifications for important updates.
                    </p>
                  </div>
                  <Switch 
                    id="email-notifications" 
                    checked={formState.notifications.email}
                    onCheckedChange={(checked) => setFormState(prev => ({ 
                      ...prev, 
                      notifications: { ...prev.notifications, email: checked } 
                    }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="marketing-notifications">Marketing Emails</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive marketing and promotional emails.
                    </p>
                  </div>
                  <Switch 
                    id="marketing-notifications" 
                    checked={formState.notifications.marketing}
                    onCheckedChange={(checked) => setFormState(prev => ({ 
                      ...prev, 
                      notifications: { ...prev.notifications, marketing: checked } 
                    }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="security-notifications">Security Alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive security and account alerts (recommended).
                    </p>
                  </div>
                  <Switch 
                    id="security-notifications" 
                    checked={formState.notifications.security}
                    onCheckedChange={(checked) => setFormState(prev => ({ 
                      ...prev, 
                      notifications: { ...prev.notifications, security: checked } 
                    }))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="display" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Display Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="language">Language</Label>
                  <Select 
                    value={formState.language} 
                    onValueChange={(value) => setFormState(prev => ({ ...prev, language: value }))}
                  >
                    <SelectTrigger id="language">
                      <SelectValue placeholder="Select Language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="fr">French</SelectItem>
                      <SelectItem value="de">German</SelectItem>
                      <SelectItem value="ja">Japanese</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select 
                    value={formState.timezone} 
                    onValueChange={(value) => setFormState(prev => ({ ...prev, timezone: value }))}
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select Timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="Europe/London">London</SelectItem>
                      <SelectItem value="Europe/Paris">Paris</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        
        <div className="flex items-center space-x-4">
          <Button onClick={handleSave} disabled={updating}>
            {updating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
          
          {saveSuccess && (
            <Alert className="flex-1">
              <AlertDescription>
                Settings saved successfully!
              </AlertDescription>
            </Alert>
          )}
          
          {saveError && (
            <Alert variant="destructive" className="flex-1">
              <AlertCircle className="h-4 w-4 mr-2" />
              <AlertDescription>
                {saveError}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  )
}
