import { BarChart3, TrendingUp, Users, Link, Brain, Calendar } from 'lucide-react';

function EmailAnalytics() {
  // Mock data for analytics
  const stats = {
    totalEmails: 1234,
    processedEmails: 987,
    extractedConcepts: 3456,
    uniqueUrls: 234,
    topSenders: [
      { email: 'researcher@university.edu', count: 156 },
      { email: 'collaborator@research.org', count: 89 },
      { email: 'journal@sciencepub.com', count: 45 },
      { email: 'conference@science.org', count: 34 },
    ],
    topConcepts: [
      { concept: 'Mitochondrial dysfunction', count: 67 },
      { concept: 'Oxidative stress', count: 54 },
      { concept: 'Neuroinflammation', count: 48 },
      { concept: 'Energy metabolism', count: 41 },
      { concept: 'Immune response', count: 38 },
    ],
    topDomains: [
      { domain: 'pubmed.ncbi.nlm.nih.gov', count: 89 },
      { domain: 'sciencedirect.com', count: 56 },
      { domain: 'nature.com', count: 34 },
      { domain: 'cell.com', count: 28 },
    ],
    emailsByMonth: [
      { month: 'Oct', count: 234 },
      { month: 'Nov', count: 312 },
      { month: 'Dec', count: 287 },
      { month: 'Jan', count: 401 },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-background-elevated">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-secondary text-sm">Total Emails</p>
              <p className="text-3xl font-bold text-text-primary mt-1">
                {stats.totalEmails.toLocaleString()}
              </p>
              <p className="text-sm text-success mt-2 flex items-center gap-1">
                <TrendingUp size={14} />
                +12% from last month
              </p>
            </div>
            <div className="p-3 bg-primary-900/50 rounded-lg">
              <BarChart3 className="text-primary-400" size={24} />
            </div>
          </div>
        </div>

        <div className="card bg-background-elevated">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-secondary text-sm">Processed</p>
              <p className="text-3xl font-bold text-text-primary mt-1">
                {stats.processedEmails.toLocaleString()}
              </p>
              <p className="text-sm text-text-muted mt-2">
                {Math.round((stats.processedEmails / stats.totalEmails) * 100)}% of total
              </p>
            </div>
            <div className="p-3 bg-success/20 rounded-lg">
              <Brain className="text-success" size={24} />
            </div>
          </div>
        </div>

        <div className="card bg-background-elevated">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-secondary text-sm">Concepts</p>
              <p className="text-3xl font-bold text-text-primary mt-1">
                {stats.extractedConcepts.toLocaleString()}
              </p>
              <p className="text-sm text-text-muted mt-2">
                Extracted insights
              </p>
            </div>
            <div className="p-3 bg-warning/20 rounded-lg">
              <Brain className="text-warning" size={24} />
            </div>
          </div>
        </div>

        <div className="card bg-background-elevated">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-secondary text-sm">Unique URLs</p>
              <p className="text-3xl font-bold text-text-primary mt-1">
                {stats.uniqueUrls}
              </p>
              <p className="text-sm text-text-muted mt-2">
                Research links
              </p>
            </div>
            <div className="p-3 bg-error/20 rounded-lg">
              <Link className="text-error" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Charts and Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Volume Chart */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Calendar size={20} />
            Email Volume by Month
          </h3>
          <div className="space-y-3">
            {stats.emailsByMonth.map((month) => {
              const percentage = (month.count / Math.max(...stats.emailsByMonth.map(m => m.count))) * 100;
              return (
                <div key={month.month}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-text-secondary">{month.month}</span>
                    <span className="text-sm font-medium text-text-primary">{month.count}</span>
                  </div>
                  <div className="w-full bg-background-elevated rounded-full h-2">
                    <div
                      className="h-full bg-primary-600 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Senders */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Users size={20} />
            Top Senders
          </h3>
          <div className="space-y-3">
            {stats.topSenders.map((sender, index) => (
              <div key={sender.email} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-text-muted font-mono text-sm">#{index + 1}</span>
                  <span className="text-text-primary text-sm truncate max-w-xs">
                    {sender.email}
                  </span>
                </div>
                <span className="badge badge-primary">{sender.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Concepts */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Brain size={20} />
            Top Research Concepts
          </h3>
          <div className="space-y-3">
            {stats.topConcepts.map((concept) => (
              <div key={concept.concept} className="flex items-center justify-between">
                <span className="text-text-primary text-sm">{concept.concept}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-background-elevated rounded-full h-1.5">
                    <div
                      className="h-full bg-success rounded-full"
                      style={{ width: `${(concept.count / stats.topConcepts[0].count) * 100}%` }}
                    />
                  </div>
                  <span className="text-text-secondary text-xs w-8 text-right">{concept.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top URL Domains */}
        <div className="card">
          <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Link size={20} />
            Top Research Sources
          </h3>
          <div className="space-y-3">
            {stats.topDomains.map((domain) => (
              <div key={domain.domain} className="flex items-center justify-between">
                <span className="text-text-primary text-sm font-mono">{domain.domain}</span>
                <span className="badge badge-warning">{domain.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmailAnalytics;