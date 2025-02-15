# Real-World Component Examples

## Example 1: File Selection and Processing
From FileTree.tsx - Shows how database operations are integrated with UI elements:

```tsx
function FileTree({ files }: FileTreeProps) {
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);

  const handleProcessSelected = async () => {
    if (selectedFiles.size === 0) {
      toast.info('Please select files to process');
      return;
    }

    setProcessing(true);
    try {
      // 1. Create a batch record
      const { data: batchData, error: batchError } = await supabase
        .from('processing_batches')
        .insert({
          status: 'queued',
          total_files: selectedFiles.size
        })
        .select()
        .single();

      if (batchError) throw batchError;

      // 2. Create document records for each file
      const { error: docsError } = await supabase
        .from('expert_documents')
        .insert(
          Array.from(selectedFiles).map(fileId => ({
            source_id: fileId,
            batch_id: batchData.id,
            status: 'queued'
          }))
        );

      if (docsError) throw docsError;
      
      toast.success(`Created batch of ${selectedFiles.size} files`);
      setSelectedFiles(new Set()); // Clear selection
    } catch (error) {
      console.error('Error creating batch:', error);
      toast.error('Failed to create processing batch');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="p-4">
      {/* File selection UI */}
      <div className="space-y-2">
        {files.map(file => (
          <div key={file.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedFiles.has(file.id)}
              onChange={() => toggleFile(file.id)}
              disabled={processing}
            />
            <span>{file.name}</span>
          </div>
        ))}
      </div>

      {/* Process button */}
      {selectedFiles.size > 0 && (
        <button
          onClick={handleProcessSelected}
          disabled={processing}
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
        >
          {processing ? 'Processing...' : `Process ${selectedFiles.size} Files`}
        </button>
      )}
    </div>
  );
}
```

Key points:
1. Database operations are wrapped in try/catch
2. Loading states control UI feedback
3. Success/error messages use toast notifications
4. UI is disabled during processing

## Example 2: Real-time Updates with Subscriptions
From BatchProgress.tsx - Shows how to update UI in real-time:

```tsx
function BatchProgress({ batchId }: { batchId: string }) {
  const [batch, setBatch] = useState<BatchStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load
    const loadBatch = async () => {
      try {
        const { data, error } = await supabase
          .from('batch_processing_status')
          .select('*')
          .eq('batch_id', batchId)
          .single();

        if (error) throw error;
        setBatch(data);
      } catch (error) {
        toast.error('Failed to load batch status');
      } finally {
        setLoading(false);
      }
    };

    loadBatch();

    // Subscribe to changes
    const subscription = supabase
      .channel(`batch-${batchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'processing_batches',
          filter: `id=eq.${batchId}`
        },
        (payload) => {
          setBatch(current => ({
            ...current,
            ...payload.new
          }));
        }
      )
      .subscribe();

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [batchId]);

  if (loading) return <div>Loading...</div>;
  if (!batch) return <div>Batch not found</div>;

  return (
    <div className="p-4 border rounded">
      <div className="flex justify-between mb-2">
        <span>Batch #{batchId.slice(-4)}</span>
        <span>{batch.status}</span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-500 h-2 rounded-full"
          style={{
            width: `${(batch.completed_count / batch.total_files) * 100}%`
          }}
        />
      </div>

      <div className="mt-2 text-sm text-gray-600">
        {batch.completed_count} / {batch.total_files} files processed
      </div>
    </div>
  );
}
```

Key points:
1. Uses useEffect for initial load and subscription setup
2. Cleans up subscription when component unmounts
3. Shows loading state while data loads
4. Updates UI automatically when database changes

## Example 3: Form Submission with Validation
From ExpertForm.tsx - Shows form handling with database updates:

```tsx
function ExpertForm({ expertId }: { expertId: string }) {
  const [expert, setExpert] = useState<Expert | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate
    if (!expert?.name) {
      setErrors(e => ({ ...e, name: 'Name is required' }));
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('experts')
        .update({
          name: expert.name,
          bio: expert.bio,
          updated_at: new Date().toISOString()
        })
        .eq('id', expertId);

      if (error) throw error;
      toast.success('Expert updated successfully');
    } catch (error) {
      console.error('Error updating expert:', error);
      toast.error('Failed to update expert');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium">
          Name
          <input
            type="text"
            value={expert?.name || ''}
            onChange={e => setExpert(x => ({ ...x!, name: e.target.value }))}
            className={`mt-1 block w-full ${errors.name ? 'border-red-500' : ''}`}
          />
        </label>
        {errors.name && (
          <p className="text-red-500 text-sm mt-1">{errors.name}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">
          Bio
          <textarea
            value={expert?.bio || ''}
            onChange={e => setExpert(x => ({ ...x!, bio: e.target.value }))}
            className="mt-1 block w-full"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
```

Key points:
1. Form state managed with useState
2. Validation before database operation
3. Loading state during save
4. Error handling with visual feedback
5. Optimistic UI updates

Would you like me to:
1. Add more examples of specific patterns?
2. Show how to handle more complex database relationships?
3. Add examples of batch operations or transactions? 