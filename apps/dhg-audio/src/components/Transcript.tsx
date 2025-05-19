interface TranscriptProps {
  content: string | null;
  isLoading: boolean;
}

export const Transcript = ({ content, isLoading }: TranscriptProps) => {
  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="space-y-3">
          <div className="h-2 bg-gray-200 rounded w-full"></div>
          <div className="h-2 bg-gray-200 rounded w-5/6"></div>
          <div className="h-2 bg-gray-200 rounded w-3/4"></div>
          <div className="h-2 bg-gray-200 rounded w-full"></div>
          <div className="h-2 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-lg font-semibold mb-4">Transcript</h2>
        <p className="text-gray-500">No transcript available for this audio.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-lg font-semibold mb-4">Transcript</h2>
      <div className="prose max-w-none">
        <p className="whitespace-pre-wrap text-gray-700">{content}</p>
      </div>
    </div>
  );
};