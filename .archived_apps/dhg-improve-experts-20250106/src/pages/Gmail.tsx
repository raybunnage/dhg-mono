import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Icons for the Gmail dashboard
const EmailIcon = () => <span className="text-blue-500 text-xl">📧</span>;
const SearchIcon = () => <span className="text-green-500 text-xl">🔍</span>;
const ContentIcon = () => <span className="text-purple-500 text-xl">📄</span>;
const AnalysisIcon = () => <span className="text-yellow-500 text-xl">🤖</span>;

// Status Card Component
interface StatusCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

const StatusCard: React.FC<StatusCardProps> = ({ title, value, icon, trend }) => (
  <div className="bg-white rounded-lg shadow p-6 flex flex-col">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-gray-700 font-medium">{title}</h3>
      <div className="p-2 rounded-full bg-gray-100">{icon}</div>
    </div>
    <div className="flex items-end">
      <span className="text-2xl font-bold">{value}</span>
      {trend && (
        <span className={`ml-2 text-sm ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
        </span>
      )}
    </div>
  </div>
);

// Activity Item Component
interface Activity {
  id: string;
  type: 'email' | 'process' | 'analyze' | 'extract';
  description: string;
  time: string;
}

const ActivityItem: React.FC<{ activity: Activity }> = ({ activity }) => {
  const getIcon = (type: Activity['type']) => {
    switch (type) {
      case 'email': return '📧';
      case 'process': return '⚙️';
      case 'analyze': return '🤖';
      case 'extract': return '📄';
      default: return '📝';
    }
  };

  return (
    <div className="flex items-start mb-4">
      <div className="p-2 rounded-full bg-gray-100 mr-4">{getIcon(activity.type)}</div>
      <div>
        <p className="text-gray-800">{activity.description}</p>
        <span className="text-sm text-gray-500">{activity.time}</span>
      </div>
    </div>
  );
};

// Activity Timeline Component
const ActivityTimeline: React.FC<{ activities: Activity[] }> = ({ activities }) => (
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
    <div className="space-y-4">
      {activities.map(activity => (
        <ActivityItem key={activity.id} activity={activity} />
      ))}
    </div>
  </div>
);

// Email Table Component
interface Email {
  id: string;
  email_id: number;
  sender: string | null;
  subject: string | null;
  date: string | null;
  attachment_cnt: number | null;
  url_cnt: number | null;
  contents_length: number | null;
  is_valid: number | null;
  is_in_contents: number | null;
  is_in_concepts: number | null;
}

const EmailTable: React.FC<{ emails: Email[], isLoading: boolean }> = ({ emails, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Email Results</h3>
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-400">Loading emails...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 overflow-hidden">
      <h3 className="text-lg font-semibold mb-4">Email Results</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sender</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attachments</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URLs</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {emails.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No emails found. Run a search to fetch new emails.
                </td>
              </tr>
            ) : (
              emails.map((email) => (
                <tr key={email.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{email.sender || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{email.subject || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{email.date || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{email.attachment_cnt || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{email.url_cnt || 0}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {email.is_in_contents ? 
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Processed</span> : 
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Pending</span>
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      className="text-indigo-600 hover:text-indigo-900 mr-2"
                      onClick={() => console.log(`View email ${email.id}`)}
                    >
                      View
                    </button>
                    {!email.is_in_contents && (
                      <button 
                        className="text-green-600 hover:text-green-900"
                        onClick={() => console.log(`Process email ${email.id}`)}
                      >
                        Process
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Email Content Table Component
interface EmailContent {
  email_content_id: number;
  email_id: number;
  how_many_participants: number;
  participants: string;
  summary_of_the_email: string;
  is_science_discussion: number;
  is_science_material: number;
  is_meeting_focused: number;
  good_quotes: string;
}

const EmailContentTable: React.FC<{ contents: EmailContent[], isLoading: boolean }> = ({ contents, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Processed Contents</h3>
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-400">Loading content data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 overflow-hidden">
      <h3 className="text-lg font-semibold mb-4">Processed Contents</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Participants</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Summary</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Science</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meeting</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {contents.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No processed contents found. Process emails to extract content.
                </td>
              </tr>
            ) : (
              contents.map((content) => (
                <tr key={content.email_content_id}>
                  <td className="px-6 py-4 whitespace-nowrap">{content.email_id}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{content.participants}</td>
                  <td className="px-6 py-4 max-w-xs truncate">{content.summary_of_the_email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${content.is_science_discussion ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        Discussion
                      </span>
                      <span className={`px-2 py-1 text-xs rounded-full ${content.is_science_material ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        Material
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${content.is_meeting_focused ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {content.is_meeting_focused ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      className="text-indigo-600 hover:text-indigo-900 mr-2"
                      onClick={() => console.log(`View content ${content.email_content_id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// URL Table Component
interface EmailUrl {
  id: number;
  email_id: number;
  url: string;
}

const UrlTable: React.FC<{ urls: EmailUrl[], isLoading: boolean }> = ({ urls, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Extracted URLs</h3>
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-400">Loading URL data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 overflow-hidden">
      <h3 className="text-lg font-semibold mb-4">Extracted URLs</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email ID</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {urls.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                  No URLs found. Process emails to extract URLs.
                </td>
              </tr>
            ) : (
              urls.map((url) => (
                <tr key={url.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{url.email_id}</td>
                  <td className="px-6 py-4 max-w-md truncate">
                    <a href={url.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {url.url}
                    </a>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button 
                      className="text-indigo-600 hover:text-indigo-900"
                      onClick={() => window.open(url.url, '_blank')}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Search Form Component
interface SearchFormProps {
  onSearch: (query: string, days: number) => void;
  isLoading: boolean;
}

const SearchForm: React.FC<SearchFormProps> = ({ onSearch, isLoading }) => {
  const [query, setQuery] = useState('');
  const [days, setDays] = useState(7);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query, days);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Search Gmail</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-1">
            Search Query (leave empty for all emails)
          </label>
          <input
            type="text"
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search terms or filters (e.g., from:example@gmail.com)"
          />
        </div>
        <div>
          <label htmlFor="days" className="block text-sm font-medium text-gray-700 mb-1">
            Days to Search Back
          </label>
          <Select value={days.toString()} onValueChange={(value) => setDays(parseInt(value))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select days" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 day</SelectItem>
              <SelectItem value="3">3 days</SelectItem>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Button 
            type="submit" 
            className="w-full bg-blue-500 hover:bg-blue-600 text-white" 
            disabled={isLoading}
          >
            {isLoading ? 'Searching...' : 'Search Gmail'}
          </Button>
        </div>
      </form>
    </div>
  );
};

// Process Control Component
interface ProcessControlProps {
  onProcessEmails: () => void;
  onProcessContents: () => void;
  onExtractUrls: () => void;
  isProcessing: boolean;
  progress: number;
}

const ProcessControl: React.FC<ProcessControlProps> = ({ 
  onProcessEmails, 
  onProcessContents, 
  onExtractUrls, 
  isProcessing, 
  progress 
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">Processing Controls</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button 
            onClick={onProcessEmails}
            className="bg-blue-500 hover:bg-blue-600 text-white"
            disabled={isProcessing}
          >
            Import New Emails
          </Button>
          <Button 
            onClick={onProcessContents}
            className="bg-green-500 hover:bg-green-600 text-white"
            disabled={isProcessing}
          >
            Process Email Contents
          </Button>
          <Button 
            onClick={onExtractUrls}
            className="bg-purple-500 hover:bg-purple-600 text-white"
            disabled={isProcessing}
          >
            Extract URLs
          </Button>
        </div>
        
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-500">Processing...</span>
              <span className="text-sm font-medium text-gray-500">{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
};

// Action Button Component
interface ActionButtonProps {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  color?: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ 
  label, 
  onClick, 
  icon, 
  color = 'bg-blue-500 hover:bg-blue-600' 
}) => (
  <button
    onClick={onClick}
    className={`${color} text-white px-4 py-3 rounded-lg shadow flex items-center justify-center`}
  >
    {icon && <span className="mr-2">{icon}</span>}
    {label}
  </button>
);

// Gmail Dashboard Page Component
function Gmail() {
  // State for data
  const [emails, setEmails] = useState<Email[]>([]);
  const [contents, setContents] = useState<EmailContent[]>([]);
  const [urls, setUrls] = useState<EmailUrl[]>([]);
  
  // State for loading and processing
  const [isSearching, setIsSearching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isLoadingContents, setIsLoadingContents] = useState(false);
  const [isLoadingUrls, setIsLoadingUrls] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  
  // Stats
  const totalEmails = 5832; // Mock data: total from DB + new
  const processedEmails = 5128; // Mock data
  const extractedUrls = 3487; // Mock data
  const pendingAnalysis = 704; // Mock data: totalEmails - processedEmails

  // Recent activities mock data
  const recentActivities: Activity[] = [
    {
      id: '1',
      type: 'email',
      description: 'Imported 25 new emails from Gmail',
      time: '10 minutes ago'
    },
    {
      id: '2',
      type: 'process',
      description: 'Processed 15 email contents with AI analysis',
      time: '45 minutes ago'
    },
    {
      id: '3',
      type: 'extract',
      description: 'Extracted 32 URLs from recent emails',
      time: '2 hours ago'
    },
    {
      id: '4',
      type: 'analyze',
      description: 'Completed AI analysis of 50 emails',
      time: '3 hours ago'
    }
  ];

  // Load initial data
  useEffect(() => {
    fetchEmails();
    fetchEmailContents();
    fetchUrls();
  }, []);

  // Mock fetch functions
  const fetchEmails = async () => {
    setIsLoadingEmails(true);
    try {
      // This would be replaced with actual API call
      const { data, error } = await supabase
        .from('emails')
        .select('*')
        .order('date', { ascending: false })
        .limit(10);
        
      if (error) throw error;
      
      // In a real implementation, this would use the actual data
      // For now, use mock data similar to what we expect
      const mockEmails: Email[] = [
        {
          id: '1',
          email_id: 12345,
          sender: 'john.doe@example.com',
          subject: 'Research Project Update',
          date: '2025-03-01',
          attachment_cnt: 2,
          url_cnt: 3,
          contents_length: 1250,
          is_valid: 1,
          is_in_contents: 1,
          is_in_concepts: 1
        },
        {
          id: '2',
          email_id: 12346,
          sender: 'research.team@example.org',
          subject: 'Meeting Notes: Project Alpha',
          date: '2025-02-28',
          attachment_cnt: 1,
          url_cnt: 0,
          contents_length: 850,
          is_valid: 1,
          is_in_contents: 1,
          is_in_concepts: 0
        },
        {
          id: '3',
          email_id: 12347,
          sender: 'conferences@science.org',
          subject: 'Call for Papers: Annual Conference',
          date: '2025-02-27',
          attachment_cnt: 0,
          url_cnt: 5,
          contents_length: 2100,
          is_valid: 1,
          is_in_contents: 0,
          is_in_concepts: 0
        }
      ];
      
      setEmails(mockEmails);
    } catch (err) {
      console.error('Error fetching emails:', err);
      toast.error('Failed to load emails');
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const fetchEmailContents = async () => {
    setIsLoadingContents(true);
    try {
      // This would be replaced with actual API call
      // For now, use mock data
      const mockContents: EmailContent[] = [
        {
          email_content_id: 1,
          email_id: 12345,
          how_many_participants: 3,
          participants: 'John Doe, Jane Smith, Bob Johnson',
          summary_of_the_email: 'Discussion of recent experimental results and next steps for the research project.',
          is_science_discussion: 1,
          is_science_material: 1,
          is_meeting_focused: 0,
          good_quotes: 'The data shows a significant improvement over previous methods.'
        },
        {
          email_content_id: 2,
          email_id: 12346,
          how_many_participants: 5,
          participants: 'Research Team, Project Lead, External Collaborators',
          summary_of_the_email: 'Minutes from the Project Alpha meeting, including action items and deadlines.',
          is_science_discussion: 1,
          is_science_material: 0,
          is_meeting_focused: 1,
          good_quotes: 'We need to finalize the methodology before proceeding to the next phase.'
        }
      ];
      
      setContents(mockContents);
    } catch (err) {
      console.error('Error fetching email contents:', err);
      toast.error('Failed to load email contents');
    } finally {
      setIsLoadingContents(false);
    }
  };

  const fetchUrls = async () => {
    setIsLoadingUrls(true);
    try {
      // This would be replaced with actual API call
      // For now, use mock data
      const mockUrls: EmailUrl[] = [
        {
          id: 1,
          email_id: 12345,
          url: 'https://example.com/research-paper.pdf'
        },
        {
          id: 2,
          email_id: 12345,
          url: 'https://github.com/research-project/repo'
        },
        {
          id: 3,
          email_id: 12345,
          url: 'https://docs.google.com/spreadsheets/d/abc123'
        },
        {
          id: 4,
          email_id: 12347,
          url: 'https://conference.science.org/2025'
        },
        {
          id: 5,
          email_id: 12347,
          url: 'https://papercall.io/science-conf-2025'
        }
      ];
      
      setUrls(mockUrls);
    } catch (err) {
      console.error('Error fetching URLs:', err);
      toast.error('Failed to load URLs');
    } finally {
      setIsLoadingUrls(false);
    }
  };

  // Handler functions
  const handleSearch = (query: string, days: number) => {
    setIsSearching(true);
    toast.success(`Searching Gmail for "${query || 'all emails'}" in the last ${days} days`);
    
    // This would call your Python backend service
    // For now, simulate a search delay
    setTimeout(() => {
      setIsSearching(false);
      toast.success(`Found 25 new emails matching your search`);
      fetchEmails(); // Refresh the emails list
    }, 2500);
  };

  const handleProcessEmails = () => {
    setIsProcessing(true);
    setProcessingProgress(0);
    
    toast.success('Starting email import process');
    
    // Simulate processing with progress updates
    const interval = setInterval(() => {
      setProcessingProgress(prev => {
        const newProgress = prev + 10;
        if (newProgress >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          toast.success('Email import completed successfully');
          fetchEmails(); // Refresh data
          return 100;
        }
        return newProgress;
      });
    }, 500);
  };

  const handleProcessContents = () => {
    setIsProcessing(true);
    setProcessingProgress(0);
    
    toast.success('Starting content extraction and AI analysis');
    
    // Simulate processing with progress updates
    const interval = setInterval(() => {
      setProcessingProgress(prev => {
        const newProgress = prev + 5;
        if (newProgress >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          toast.success('Content analysis completed successfully');
          fetchEmailContents(); // Refresh data
          return 100;
        }
        return newProgress;
      });
    }, 300);
  };

  const handleExtractUrls = () => {
    setIsProcessing(true);
    setProcessingProgress(0);
    
    toast.success('Starting URL extraction from emails');
    
    // Simulate processing with progress updates
    const interval = setInterval(() => {
      setProcessingProgress(prev => {
        const newProgress = prev + 15;
        if (newProgress >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          toast.success('URL extraction completed successfully');
          fetchUrls(); // Refresh data
          return 100;
        }
        return newProgress;
      });
    }, 400);
  };

  // Buttons for quick actions
  const handleExportData = () => toast.success('Exporting data (not implemented)');
  const handleRunAnalysis = () => toast.success('Running full analysis (not implemented)');
  const handleCleanupData = () => toast.success('Data cleanup initiated (not implemented)');
  const handleConfigureSettings = () => toast.success('Settings configuration (not implemented)');

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Gmail Analysis Dashboard</h1>
      
      {/* Status Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatusCard 
          title="Total Emails" 
          value={totalEmails} 
          icon={<EmailIcon />} 
          trend={{ value: 2, isPositive: true }}
        />
        <StatusCard 
          title="Processed Emails" 
          value={processedEmails} 
          icon={<ContentIcon />}
        />
        <StatusCard 
          title="Extracted URLs" 
          value={extractedUrls} 
          icon={<SearchIcon />} 
          trend={{ value: 5, isPositive: true }}
        />
        <StatusCard 
          title="Pending Analysis" 
          value={pendingAnalysis} 
          icon={<AnalysisIcon />} 
          trend={{ value: 12, isPositive: false }}
        />
      </div>
      
      {/* Controls Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1">
          <SearchForm onSearch={handleSearch} isLoading={isSearching} />
          
          <ProcessControl 
            onProcessEmails={handleProcessEmails}
            onProcessContents={handleProcessContents}
            onExtractUrls={handleExtractUrls}
            isProcessing={isProcessing}
            progress={processingProgress}
          />
          
          <ActivityTimeline activities={recentActivities} />
        </div>
        
        <div className="lg:col-span-2">
          <Tabs defaultValue="emails" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="emails">Emails</TabsTrigger>
              <TabsTrigger value="contents">Contents</TabsTrigger>
              <TabsTrigger value="urls">URLs</TabsTrigger>
            </TabsList>
            <TabsContent value="emails">
              <EmailTable emails={emails} isLoading={isLoadingEmails} />
            </TabsContent>
            <TabsContent value="contents">
              <EmailContentTable contents={contents} isLoading={isLoadingContents} />
            </TabsContent>
            <TabsContent value="urls">
              <UrlTable urls={urls} isLoading={isLoadingUrls} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Quick Action Panel */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ActionButton 
            label="Export Data" 
            onClick={handleExportData} 
            icon="📤"
          />
          <ActionButton 
            label="Run Analysis" 
            onClick={handleRunAnalysis} 
            icon="📊" 
            color="bg-purple-500 hover:bg-purple-600"
          />
          <ActionButton 
            label="Cleanup Data" 
            onClick={handleCleanupData} 
            icon="🧹" 
            color="bg-green-500 hover:bg-green-600"
          />
          <ActionButton 
            label="Configure" 
            onClick={handleConfigureSettings} 
            icon="⚙️" 
            color="bg-indigo-500 hover:bg-indigo-600"
          />
        </div>
      </div>
    </div>
  );
}

export default Gmail;