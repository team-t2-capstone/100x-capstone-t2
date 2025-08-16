"use client";

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  RefreshCw, 
  Database, 
  Cloud, 
  Brain,
  Loader2
} from 'lucide-react';
import { dashboardApi } from '@/lib/dashboard-api';

interface ServiceStatus {
  status: 'healthy' | 'unhealthy';
  capabilities: string[];
}

interface CleanupHealth {
  cleanup_ready: boolean;
  services: {
    supabase: ServiceStatus;
    openai: ServiceStatus;
    storage: ServiceStatus;
  };
  errors: string[];
  message: string;
  timestamp: string;
}

export function CleanupHealthCheck() {
  const [health, setHealth] = useState<CleanupHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setLoading(true);
    try {
      const healthData = await dashboardApi.checkCleanupHealth();
      setHealth(healthData);
      setLastChecked(new Date());
    } catch (error) {
      console.error('Failed to check cleanup health:', error);
      // Set a default error state
      setHealth({
        cleanup_ready: false,
        services: {
          supabase: { status: 'unhealthy', capabilities: [] },
          openai: { status: 'unhealthy', capabilities: [] },
          storage: { status: 'unhealthy', capabilities: [] }
        },
        errors: [error instanceof Error ? error.message : 'Failed to check health'],
        message: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const getServiceIcon = (serviceName: string) => {
    switch (serviceName) {
      case 'supabase':
        return <Database className="h-5 w-5" />;
      case 'openai':
        return <Brain className="h-5 w-5" />;
      case 'storage':
        return <Cloud className="h-5 w-5" />;
      default:
        return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
    }
  };

  const getOverallStatusColor = () => {
    if (!health) return 'bg-gray-100';
    return health.cleanup_ready ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200';
  };

  const getOverallStatusBadge = () => {
    if (!health) return <Badge variant="secondary">Unknown</Badge>;
    return health.cleanup_ready 
      ? <Badge className="bg-green-100 text-green-800 border-green-300">Operational</Badge>
      : <Badge variant="destructive">Degraded</Badge>;
  };

  if (!health && !loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Cleanup System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">Health status not available</p>
            <Button onClick={checkHealth} disabled={loading}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Check Health
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={getOverallStatusColor()}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {health?.cleanup_ready ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            Cleanup System Health
          </CardTitle>
          <div className="flex items-center gap-2">
            {getOverallStatusBadge()}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={checkHealth} 
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Status */}
        <div className="text-center py-2">
          <p className="text-lg font-medium mb-1">
            {health?.message || 'Checking...'}
          </p>
          {lastChecked && (
            <p className="text-sm text-gray-600">
              Last checked: {lastChecked.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Service Status Grid */}
        {health && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(health.services).map(([serviceName, service]) => (
              <div key={serviceName} className="border rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getServiceIcon(serviceName)}
                    <span className="font-medium capitalize">{serviceName}</span>
                  </div>
                  {getStatusIcon(service.status)}
                </div>
                
                <div className="space-y-2">
                  <Badge 
                    variant={service.status === 'healthy' ? 'default' : 'destructive'}
                    className="text-xs"
                  >
                    {service.status}
                  </Badge>
                  
                  {service.capabilities.length > 0 && (
                    <div className="text-xs text-gray-600">
                      <p className="font-medium mb-1">Capabilities:</p>
                      <ul className="space-y-1">
                        {service.capabilities.map((capability, index) => (
                          <li key={index} className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            {capability.replace(/_/g, ' ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Errors */}
        {health?.errors && health.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <p className="font-medium">Issues detected:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {health.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Recommendations */}
        {health && !health.cleanup_ready && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Recommended actions:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {!health.services.openai || health.services.openai.status !== 'healthy' && (
                    <li>Check OpenAI API key configuration in backend environment</li>
                  )}
                  {!health.services.supabase || health.services.supabase.status !== 'healthy' && (
                    <li>Verify Supabase connection and credentials</li>
                  )}
                  {!health.services.storage || health.services.storage.status !== 'healthy' && (
                    <li>Check Supabase storage permissions and configuration</li>
                  )}
                  <li>Review backend logs for detailed error information</li>
                  <li>Contact system administrator if issues persist</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Impact Statement */}
        {health && (
          <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded">
            <p className="font-medium mb-1">Impact on clone deletion:</p>
            {health.cleanup_ready ? (
              <p className="text-green-700">
                ✓ All cleanup systems operational. Clone deletions will remove all associated data completely.
              </p>
            ) : (
              <p className="text-amber-700">
                ⚠ Some cleanup systems unavailable. Clone deletions may leave orphaned data in affected systems.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}