export const AboutPage = () => {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">About DHG Hub</h1>
      
      <div className="prose max-w-none">
        <p className="mb-4">
          DHG Hub is a sophisticated single-page application designed for displaying, filtering, and 
          interacting with presentation videos and their associated content. The application serves as 
          a central access point for viewing expert presentations, related documents, and AI-processed analysis.
        </p>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2 mt-6">Key Features</h2>
        <ul className="list-disc pl-5 mb-4">
          <li><strong>Video Presentations</strong>: Access expert presentations with integrated video playback</li>
          <li><strong>Filter Profiles</strong>: Use predefined filter configurations to view specific content sets</li>
          <li><strong>Subject Classification</strong>: Browse presentations organized by topics and categories</li>
          <li><strong>AI-Processed Content</strong>: View summaries and analysis generated from presentation materials</li>
          <li><strong>Asset Management</strong>: Access related documents, images, and resources for each presentation</li>
          <li><strong>Expert Information</strong>: Learn about the experts presenting the content</li>
          <li><strong>Powerful Search</strong>: Search across titles, expert names, and content</li>
        </ul>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2 mt-6">How to Use DHG Hub</h2>
        <ol className="list-decimal pl-5 mb-4">
          <li><strong>Select a Filter Profile</strong>: Choose from available filter profiles to customize which content you see</li>
          <li><strong>Browse Presentations</strong>: Use the search bar or subject filters to find presentations of interest</li>
          <li><strong>Watch Videos</strong>: Click on any presentation to view the video and associated information</li>
          <li><strong>Explore Assets</strong>: View related documents, slides, and other materials for each presentation</li>
          <li><strong>Read AI Summaries</strong>: Access AI-processed analysis and summaries of the content</li>
        </ol>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2 mt-6">Data Organization</h2>
        <p className="mb-4">
          Content in DHG Hub is organized through several interconnected systems:
        </p>
        <ul className="list-disc pl-5 mb-4">
          <li><strong>Presentations</strong>: Central content units containing videos and metadata</li>
          <li><strong>Experts</strong>: Information about content creators and presenters</li>
          <li><strong>Subject Classifications</strong>: Hierarchical topic organization</li>
          <li><strong>Filter Profiles</strong>: Customizable views of the content library</li>
          <li><strong>Assets</strong>: Supporting materials linked to presentations</li>
        </ul>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2 mt-6">Technical Architecture</h2>
        <p className="mb-4">
          DHG Hub is built as a modern single-page application using:
        </p>
        <ul className="list-disc pl-5 mb-4">
          <li>React for the user interface</li>
          <li>TypeScript for type-safe code</li>
          <li>Supabase for database and authentication</li>
          <li>Vite for fast development and optimized builds</li>
          <li>Tailwind CSS for responsive design</li>
        </ul>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2 mt-6">Performance Features</h2>
        <ul className="list-disc pl-5 mb-4">
          <li>Client-side filtering for responsive search</li>
          <li>Efficient caching of filter configurations</li>
          <li>Collapsible sections to manage visual complexity</li>
          <li>Optimized database queries for fast loading</li>
        </ul>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2 mt-6">Contact</h2>
        <p>
          For questions, feedback, or support regarding DHG Hub, please contact the Dynamic Healing Group team.
        </p>
      </div>
    </div>
  );
};