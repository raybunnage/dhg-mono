import { FileTree } from '@/components/FileTree';

export default function ProfilerPage() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Expert Document Folders</h1>
      </div>
      <FileTree />
    </div>
  );
} 