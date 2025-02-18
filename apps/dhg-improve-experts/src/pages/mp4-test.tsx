import { useState } from 'react';

function MP4Test() {
  const [videoId, setVideoId] = useState('1OnhPxKj1TizBUmrCCjGkNn30qHyqbnst'); // Example Google Drive video ID
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const handlePlayVideo = () => {
    // Use the same preview URL pattern as PDF, but for MP4
    const url = `https://drive.google.com/file/d/${videoId}/preview`;
    setVideoUrl(url);
  };

  return (
    <div className="h-screen bg-background p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-3xl font-bold text-primary">MP4 Test Player</h1>
        
        <div className="p-4 border rounded-lg">
          <div className="flex gap-2 items-center">
            <input 
              type="text"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              className="flex-1 p-2 border rounded"
              placeholder="Enter Google Drive Video ID"
            />
            <button 
              onClick={handlePlayVideo}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Play
            </button>
          </div>
        </div>

        {videoUrl && (
          <div className="p-4 border rounded-lg">
            <div className="aspect-video bg-muted rounded">
              <iframe 
                src={videoUrl}
                className="w-full h-full rounded"
                title="Video Preview"
                allow="autoplay"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MP4Test; 