import React, { useState } from 'react';

interface Education {
  year?: number;
  degree?: string;
  institution?: string;
  field?: string;
}

interface CurrentRole {
  position?: string;
  departments?: string[];
  institution?: string;
}

interface Leadership {
  role: string;
  organization: string;
}

interface CurrentPosition {
  role: string;
  organization: string;
}

interface Publication {
  year: number;
  title: string;
}

interface ProcessedProfile {
  name: string;
  title: string;
  website?: string;
  expertise: string[];
  background?: {
    education: Education;
    personalInsight?: string;
  };
  experience?: string[];
  currentRole?: string | CurrentRole;
  achievements?: string[] | null;
  specialization?: string;
  affiliation?: string;
  publications?: Publication[];
  researchFocus?: string | string[];
  currentPositions?: CurrentPosition[];
  leadership?: Leadership[];
  researchInterests?: string[];
}

interface ProcessedProfileViewerProps {
  profile: ProcessedProfile;
}

// Helper function to safely render potentially structured content
const renderStructuredContent = (
  content: string | Record<string, any>,
  formatter: (obj: Record<string, any>) => string
) => {
  if (typeof content === 'string') {
    return content;
  }
  return formatter(content);
};

export const ProcessedProfileViewer = ({ profile }: ProcessedProfileViewerProps) => {
  // Add state for JSON visibility
  const [showRawJson, setShowRawJson] = useState(false);

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 space-y-8">
      {/* Header Section - More prominent */}
      <div className="border-b border-gray-200 pb-6">
        <h2 className="text-3xl font-serif text-gray-900 mb-3">{profile.name}</h2>
        <div className="space-y-2">
          {profile.title && (
            <div className="text-xl text-gray-700 font-medium">{profile.title}</div>
          )}
          {profile.affiliation && (
            <div className="text-lg text-gray-600">{profile.affiliation}</div>
          )}
          {profile.website && (
            <a 
              href={profile.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
            >
              🔗 <span className="hover:underline">Personal Website</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Content - Two Column Layout for larger screens */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-8">
          {/* Current Positions */}
          {(profile.currentRole || profile.currentPositions) && (
            <section className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">
                Current Positions
              </h3>
              {typeof profile.currentRole === 'string' ? (
                <div className="text-gray-700">{profile.currentRole}</div>
              ) : profile.currentRole && (
                <div className="space-y-2">
                  <div className="font-medium">{profile.currentRole.position}</div>
                  {profile.currentRole.departments && (
                    <div className="text-gray-600">
                      Departments: {profile.currentRole.departments.join(', ')}
                    </div>
                  )}
                  {profile.currentRole.institution && (
                    <div className="text-gray-600">{profile.currentRole.institution}</div>
                  )}
                </div>
              )}
              {profile.currentPositions && (
                <div className="space-y-2">
                  {profile.currentPositions.map((pos, i) => (
                    <div key={i} className="text-gray-700">
                      {pos.role} at {pos.organization}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Expertise */}
          {profile.expertise && (
            <section className="bg-white p-6 rounded-lg border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">
                Areas of Expertise
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.expertise.map((area, i) => (
                  <span 
                    key={i} 
                    className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium"
                  >
                    {area}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Research Interests - New Section */}
          {profile.researchInterests && profile.researchInterests.length > 0 && (
            <section className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">
                Research Interests
              </h3>
              <div className="flex flex-wrap gap-2">
                {profile.researchInterests.map((interest, i) => (
                  <span 
                    key={i} 
                    className="bg-purple-50 text-purple-700 px-4 py-1.5 rounded-full text-sm font-medium"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Research Focus */}
          {profile.researchFocus && (
            <section className="bg-white p-6 rounded-lg border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">
                Research Focus
              </h3>
              {typeof profile.researchFocus === 'string' ? (
                <p className="text-gray-700 leading-relaxed">{profile.researchFocus}</p>
              ) : (
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  {profile.researchFocus.map((focus, i) => (
                    <li key={i} className="leading-relaxed">{focus}</li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* Leadership */}
          {profile.leadership && profile.leadership.length > 0 && (
            <section className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">
                Leadership Positions
              </h3>
              <div className="space-y-3">
                {profile.leadership.map((pos, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="font-medium text-gray-900">{pos.role}</span>
                    <span className="text-gray-600">{pos.organization}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Full Width Sections */}
      {/* Publications */}
      {profile.publications && profile.publications.length > 0 && (
        <section className="bg-white p-6 rounded-lg border border-gray-100">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">
            Publications
          </h3>
          <div className="space-y-3">
            {profile.publications.map((pub, i) => (
              <div key={i} className="text-gray-700 flex justify-between items-baseline">
                <span className="font-medium">{pub.title}</span>
                <span className="text-gray-500 ml-4">{pub.year}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Achievements */}
      {profile.achievements && profile.achievements.length > 0 && (
        <section className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">
            Key Achievements
          </h3>
          <ul className="list-disc list-inside text-gray-700 space-y-2">
            {profile.achievements.map((achievement, i) => (
              <li key={i} className="leading-relaxed pl-2">
                <span className="ml-2">{achievement}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Raw JSON Viewer */}
      <div className="pt-6 border-t border-gray-200">
        <button
          onClick={() => setShowRawJson(!showRawJson)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <span className="font-medium">{showRawJson ? '▼' : '▶'}</span>
          <span>View Raw JSON Data</span>
        </button>
        
        {showRawJson && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg overflow-x-auto border border-gray-200">
            <pre className="text-sm text-gray-800 whitespace-pre-wrap">
              {JSON.stringify(profile, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}; 