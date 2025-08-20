"use client"

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Brain, CheckCircle, AlertCircle, FileText, Clock } from 'lucide-react';
import useRAG from '@/hooks/use-rag';

interface MemoryLayerControlProps {
  cloneId: string;
  hasDocuments: boolean;
  documentCount: number;
  onRAGEnabled?: (enabled: boolean) => void;
  onRAGReady?: (ready: boolean) => void;
}

export function MemoryLayerControl({ 
  cloneId, 
  hasDocuments, 
  documentCount = 0,
  onRAGEnabled,
  onRAGReady 
}: MemoryLayerControlProps) {
  const {
    status,
    isInitialized,
    isInitializing,
    documentCount: ragDocCount,
    error,
    loading,
    lastInitialized,
    initializeRAG,
    enableRAG,
    checkStatus
  } = useRAG(cloneId);

  const [initProgress, setInitProgress] = useState(0);
  const [initPhase, setInitPhase] = useState('');

  // Notify parent when RAG status changes
  useEffect(() => {
    onRAGEnabled?.(status !== 'disabled');
    onRAGReady?.(status === 'ready');
  }, [status, onRAGEnabled, onRAGReady]);

  // Simulate progress for initialization
  useEffect(() => {
    if (isInitializing) {
      const phases = [
        'Analyzing documents...',
        'Creating memory embeddings...',
        'Optimizing knowledge retrieval...',
        'Finalizing memory layer...'
      ];
      
      let progress = 0;
      let phaseIndex = 0;
      
      const progressInterval = setInterval(() => {
        progress += Math.random() * 10;
        
        if (progress > 25 && phaseIndex === 0) {
          phaseIndex = 1;
          setInitPhase(phases[1]);
        } else if (progress > 50 && phaseIndex === 1) {
          phaseIndex = 2;
          setInitPhase(phases[2]);
        } else if (progress > 75 && phaseIndex === 2) {
          phaseIndex = 3;
          setInitPhase(phases[3]);
        }
        
        if (progress >= 95) {
          progress = 95;
          clearInterval(progressInterval);
        }
        
        setInitProgress(progress);
      }, 500);

      setInitPhase(phases[0]);
      
      return () => clearInterval(progressInterval);
    } else {
      setInitProgress(0);
      setInitPhase('');
    }
  }, [isInitializing]);

  const handleInitialize = async () => {
    try {
      await initializeRAG();
    } catch (error) {
      console.error('RAG initialization failed:', error);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'initializing':
        return <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Brain className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'ready':
        return 'Memory Layer Active';
      case 'initializing':
        return 'Memory Layer Initializing...';
      case 'error':
        return 'Memory Layer Error';
      default:
        return 'Memory Layer Disabled';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'initializing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (!hasDocuments) {
    return (
      <Card className="border-2 border-dashed border-gray-300">
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <FileText className="h-12 w-12 mx-auto text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900">No Documents Uploaded</h3>
            <p className="text-sm text-gray-600">
              Upload documents to enable the Memory Layer feature. The Memory Layer allows your clone to have intelligent conversations based on your uploaded content.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            Memory Layer
          </CardTitle>
          <Badge variant="outline" className={getStatusColor()}>
            {getStatusIcon()}
            <span className="ml-1">{getStatusText()}</span>
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Document Summary */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Documents Ready:</span>
            <span className="font-medium">{documentCount} files</span>
          </div>
          {ragDocCount > 0 && ragDocCount !== documentCount && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Processed for Memory:</span>
              <span className="font-medium">{ragDocCount} files</span>
            </div>
          )}
        </div>

        {/* Status and Actions */}
        {status === 'disabled' && (
          <div className="space-y-3">
            <Alert>
              <Brain className="h-4 w-4" />
              <AlertDescription>
                Enable the Memory Layer to allow your clone to have intelligent conversations based on your uploaded documents.
              </AlertDescription>
            </Alert>
            <Button 
              onClick={handleInitialize}
              disabled={loading || isInitializing}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enabling...
                </>
              ) : (
                <>
                  <Brain className="mr-2 h-4 w-4" />
                  Enable Memory Layer
                </>
              )}
            </Button>
          </div>
        )}

        {status === 'initializing' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Progress</span>
                <span className="font-medium">{Math.round(initProgress)}%</span>
              </div>
              <Progress value={initProgress} className="h-2" />
              {initPhase && (
                <p className="text-sm text-blue-600 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {initPhase}
                </p>
              )}
            </div>
            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Preparing your Memory Layer. This usually takes 30 seconds to 2 minutes depending on your document collection.
              </AlertDescription>
            </Alert>
          </div>
        )}

        {status === 'ready' && (
          <div className="space-y-3">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Memory Layer is active! Your clone can now have intelligent conversations based on your uploaded documents.
              </AlertDescription>
            </Alert>
            
            {lastInitialized && (
              <div className="text-xs text-gray-500 text-center">
                Last updated: {lastInitialized.toLocaleString()}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-blue-50 rounded-lg p-2">
                <div className="font-medium text-lg text-blue-600">{ragDocCount}</div>
                <div className="text-xs text-blue-600">Documents</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-2">
                <div className="font-medium text-lg text-purple-600">Ready</div>
                <div className="text-xs text-purple-600">Status</div>
              </div>
              <div className="bg-green-50 rounded-lg p-2">
                <div className="font-medium text-lg text-green-600">Active</div>
                <div className="text-xs text-green-600">Memory</div>
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error || 'Failed to initialize Memory Layer. Please try again.'}
              </AlertDescription>
            </Alert>
            <Button 
              onClick={handleInitialize}
              disabled={loading}
              variant="outline"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                'Retry Initialization'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}