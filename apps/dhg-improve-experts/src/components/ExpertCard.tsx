interface ExpertProfile {
  id: string;
  name: string;
  title: string;
  shortBio: string;
  expertise: string[];
  profileImage?: string;
  presentations: {
    id: string;
    title: string;
    date: string;
    videoUrl?: string;
  }[];
  achievements: {
    publications: number;
    citations: number;
    highlights: string[];
  };
}

export default function ExpertCard({ expert }: { expert: ExpertProfile }) {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Main Profile Section */}
      <div className="flex items-start p-6">
        {expert.profileImage ? (
          <img 
            src={expert.profileImage} 
            alt={expert.name}
            className="w-24 h-24 rounded-full object-cover"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center">
            <span className="text-2xl text-gray-500">
              {expert.name.charAt(0)}
            </span>
          </div>
        )}
        
        <div className="ml-6">
          <h3 className="text-xl font-semibold">{expert.name}</h3>
          <p className="text-gray-600">{expert.title}</p>
          
          {/* Expertise Tags */}
          <div className="mt-2 flex flex-wrap gap-2">
            {expert.expertise.map(skill => (
              <span key={skill} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                {skill}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-6 py-4 bg-gray-50 flex justify-between text-sm">
        <div>
          <span className="font-semibold">{expert.achievements.publications}</span>
          <span className="text-gray-600 ml-1">Publications</span>
        </div>
        <div>
          <span className="font-semibold">{expert.presentations.length}</span>
          <span className="text-gray-600 ml-1">Presentations</span>
        </div>
        <div>
          <span className="font-semibold">{expert.achievements.citations}</span>
          <span className="text-gray-600 ml-1">Citations</span>
        </div>
      </div>

      {/* Latest Presentation */}
      {expert.presentations[0] && (
        <div className="p-6 border-t">
          <h4 className="font-medium mb-2">Latest Presentation</h4>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <p className="font-medium">{expert.presentations[0].title}</p>
              <p className="text-sm text-gray-600">
                {new Date(expert.presentations[0].date).toLocaleDateString()}
              </p>
            </div>
            {expert.presentations[0].videoUrl && (
              <a 
                href={expert.presentations[0].videoUrl}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Watch
              </a>
            )}
          </div>
        </div>
      )}

      {/* View Profile Link */}
      <div className="p-6 bg-gray-50 border-t">
        <a 
          href={`/experts/${expert.id}`}
          className="text-blue-600 hover:text-blue-800 font-medium flex items-center justify-center"
        >
          View Full Profile
          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
} 