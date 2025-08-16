"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  AlertTriangle, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Database, 
  Cloud, 
  Brain,
  FileText,
  Users,
  Zap
} from 'lucide-react';
import { dashboardApi } from '@/lib/dashboard-api';

interface CleanupStep {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  message: string;
  details?: any;
}

interface DeletionPreview {
  clone: {
    id: string;
    name: string;
    created_at: string;
    category?: string;
    is_published?: boolean;
  };
  database_records: Record<string, number>;
  storage_files: {
    total_count: number;
    knowledge_documents: number;
    avatar: number;
    file_urls: string[];
  };
  openai_resources: {
    vector_stores: number;
    assistants: number;
    estimated_files: number;
    expert_name?: string;
  };
  impact_assessment: {
    has_active_sessions: boolean;
    active_sessions_count?: number;
    total_database_records: number;
    total_storage_files: number;
    total_openai_resources: number;
    deletion_complexity: 'simple' | 'moderate' | 'complex' | 'unknown';
    estimated_deletion_time_seconds: number;
  };
}

interface EnhancedDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  clone: {
    id: string;
    name: string;
    category: string;
    sessions: number;
    status: string;
  };
  loading?: boolean;
}

export function EnhancedDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  clone,
  loading = false
}: EnhancedDeleteDialogProps) {
  const [step, setStep] = useState<'preview' | 'confirm' | 'deleting' | 'completed'>('preview');
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [cleanupSteps, setCleanupSteps] = useState<CleanupStep[]>([]);
  const [forceDelete, setForceDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deletionProgress, setDeletionProgress] = useState(0);
  const [deletionResult, setDeletionResult] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Load deletion preview when dialog opens
  useEffect(() => {
    if (isOpen && step === 'preview') {
      loadDeletionPreview();
    }
  }, [isOpen, step]);

  const loadDeletionPreview = async () => {
    try {
      const previewData = await dashboardApi.getCloneDeletionPreview(clone.id);
      setPreview(previewData.preview);
    } catch (error) {
      console.error('Failed to load deletion preview:', error);
      setErrors(['Failed to load deletion preview. You can still proceed with deletion.']);
    }
  };

  const getStepIcon = (status: CleanupStep['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />;
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-gray-300" />;
    }
  };

  const handleDelete = async () => {
    setStep('deleting');
    setErrors([]);
    setWarnings([]);
    setDeletionProgress(0);

    try {
      const result = await dashboardApi.deleteClone(clone.id, { 
        force: forceDelete,
        showProgress: true 
      });

      if (result.success) {
        setStep('completed');
        setDeletionResult(result);
        setWarnings(result.warnings || []);
        setDeletionProgress(100);
        
        // Auto-close and trigger parent callback after a delay
        setTimeout(() => {
          onConfirm();
          onClose();
        }, 2000);
      } else {
        setErrors([result.message || 'Deletion failed']);
        setStep('confirm');
      }
    } catch (error) {
      console.error('Deletion failed:', error);
      setErrors([error instanceof Error ? error.message : 'Unexpected error during deletion']);
      setStep('confirm');
    }
  };

  const canProceed = () => {
    if (clone.sessions > 0 && !forceDelete) {
      return false;
    }
    return confirmText === clone.name;
  };

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Review what will be deleted</h3>
        <p className="text-sm text-gray-600">
          This action will permanently delete clone &quot;{clone.name}&quot; and all associated data.
        </p>
      </div>

      {preview && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Database Records */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-5 w-5 text-blue-600" />
              <h4 className="font-medium">Database Records</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Sessions</span>
                <Badge variant="secondary">{preview.database_records.sessions || 0}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Knowledge entries</span>
                <Badge variant="secondary">{preview.database_records.knowledge || 0}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Training data</span>
                <Badge variant="secondary">{preview.database_records.clone_qa_training || 0}</Badge>
              </div>
            </div>
          </div>

          {/* Storage Files */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cloud className="h-5 w-5 text-green-600" />
              <h4 className="font-medium">Storage Files</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Knowledge documents</span>
                <Badge variant="secondary">{preview.storage_files.knowledge_documents || 0}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Avatar</span>
                <Badge variant="secondary">{preview.storage_files.avatar || 0}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total files</span>
                <Badge variant="secondary">{preview.storage_files.total_count || 0}</Badge>
              </div>
            </div>
          </div>

          {/* OpenAI Resources */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-5 w-5 text-purple-600" />
              <h4 className="font-medium">AI Resources</h4>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Vector stores</span>
                <Badge variant="secondary">{preview.openai_resources.vector_stores}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Assistants</span>
                <Badge variant="secondary">{preview.openai_resources.assistants}</Badge>
              </div>
              <div className="flex justify-between text-sm">
                <span>Files</span>
                <Badge variant="secondary">{preview.openai_resources.estimated_files}</Badge>
              </div>
              {preview.openai_resources.expert_name && (
                <div className="text-xs text-gray-500 mt-2">
                  Expert: {preview.openai_resources.expert_name}
                </div>
              )}
            </div>
          </div>

          {/* Impact Summary */}
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-5 w-5 text-orange-600" />
              <h4 className="font-medium">Impact Assessment</h4>
            </div>
            <div className="space-y-2 text-sm">
              <div className={preview.impact_assessment.has_active_sessions ? "text-amber-700" : "text-green-700"}>
                • {preview.impact_assessment.has_active_sessions 
                  ? `${preview.impact_assessment.active_sessions_count || 0} active sessions will be terminated`
                  : 'No active sessions'
                }
              </div>
              <div className="text-gray-600">
                • {preview.impact_assessment.total_database_records} database records
              </div>
              <div className="text-gray-600">
                • {preview.impact_assessment.total_storage_files} storage files
              </div>
              <div className="text-gray-600">
                • {preview.impact_assessment.total_openai_resources} AI resources
              </div>
              <div className="flex items-center gap-2">
                <span>Complexity:</span>
                <Badge variant={
                  preview.impact_assessment.deletion_complexity === 'simple' ? 'default' :
                  preview.impact_assessment.deletion_complexity === 'moderate' ? 'secondary' :
                  preview.impact_assessment.deletion_complexity === 'complex' ? 'destructive' : 'outline'
                }>
                  {preview.impact_assessment.deletion_complexity}
                </Badge>
              </div>
              <div className="text-xs text-gray-500">
                Estimated time: ~{preview.impact_assessment.estimated_deletion_time_seconds}s
              </div>
              <div className="text-red-700 font-medium">
                • This action cannot be undone
              </div>
            </div>
          </div>
        </div>
      )}

      {clone.sessions > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This clone has {clone.sessions} active sessions. Check &quot;Force delete&quot; to terminate them.
          </AlertDescription>
        </Alert>
      )}

      {errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            {errors.join('. ')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col space-y-3">
        {clone.sessions > 0 && (
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="force-delete" 
              checked={forceDelete}
              onCheckedChange={(checked) => setForceDelete(checked as boolean)}
            />
            <label htmlFor="force-delete" className="text-sm">
              Force delete (terminate active sessions)
            </label>
          </div>
        )}
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          onClick={() => setStep('confirm')}
          disabled={clone.sessions > 0 && !forceDelete}
        >
          Continue
        </Button>
      </div>
    </div>
  );

  const renderConfirmStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Trash2 className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2 text-red-700">Confirm Deletion</h3>
        <p className="text-sm text-gray-600">
          This action is irreversible. Type the clone name to confirm.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Type &quot;{clone.name}&quot; to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            placeholder={clone.name}
          />
        </div>

        {forceDelete && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Force deletion will terminate {clone.sessions} active sessions immediately.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex justify-between gap-3">
        <Button variant="outline" onClick={() => setStep('preview')}>
          Back
        </Button>
        <Button 
          variant="destructive" 
          onClick={handleDelete}
          disabled={!canProceed() || loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Permanently
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const renderDeletingStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Deleting Clone</h3>
        <p className="text-sm text-gray-600">
          Please wait while we clean up all data...
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span>Overall Progress</span>
            <span>{deletionProgress}%</span>
          </div>
          <Progress value={deletionProgress} className="w-full" />
        </div>

        {cleanupSteps.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Cleanup Steps:</h4>
            {cleanupSteps.map((step, index) => (
              <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded text-sm">
                {getStepIcon(step.status)}
                <span className="flex-1">{step.message}</span>
                <Badge variant={
                  step.status === 'completed' ? 'default' :
                  step.status === 'failed' ? 'destructive' :
                  step.status === 'in_progress' ? 'secondary' : 'outline'
                }>
                  {step.status}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderCompletedStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2 text-green-700">Deletion Complete</h3>
        <p className="text-sm text-gray-600">
          Clone &quot;{clone.name}&quot; has been successfully deleted.
        </p>
      </div>

      {warnings.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p className="font-medium">Deletion completed with warnings:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-center">
        <Button onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Delete Clone: {clone.name}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {step === 'preview' && renderPreviewStep()}
          {step === 'confirm' && renderConfirmStep()}
          {step === 'deleting' && renderDeletingStep()}
          {step === 'completed' && renderCompletedStep()}
        </div>
      </DialogContent>
    </Dialog>
  );
}