export const AboutPage = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">About DHG Audio</h1>
      
      <div className="prose max-w-none">
        <p className="mb-4">
          DHG Audio is a specialized audio learning platform designed for the Dynamic Healing Group community. 
          This app allows you to access and listen to presentations on the go, making it easier to 
          continue your learning journey wherever you are.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2 mt-6">Features</h2>
        <ul className="list-disc pl-5 mb-4">
          <li>Stream audio presentations directly from our library</li>
          <li>Read transcripts while listening (when available)</li>
          <li>Adjust playback speed for comfortable listening</li>
          <li>Mobile-optimized interface for on-the-go learning</li>
        </ul>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2 mt-6">How to Use</h2>
        <ol className="list-decimal pl-5 mb-4">
          <li>Browse the list of available audio files on the home page</li>
          <li>Select an audio file to open the player page</li>
          <li>Use the playback controls to play, pause, and adjust volume</li>
          <li>Scroll down to view the transcript if available</li>
        </ol>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2 mt-6">Contact</h2>
        <p>
          For questions, feedback, or support, please contact the Dynamic Healing Group team.
        </p>
      </div>
    </div>
  );
};