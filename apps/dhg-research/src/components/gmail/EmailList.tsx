import { useState } from 'react';
import { format } from 'date-fns';
import { Mail, Paperclip, Link, Star, Archive, MoreVertical, ChevronDown } from 'lucide-react';

interface Email {
  id: string;
  sender: string;
  subject: string;
  date: Date;
  preview: string;
  hasAttachments: boolean;
  urlCount: number;
  isProcessed: boolean;
  importance: number;
  isStarred: boolean;
}

// Mock data
const mockEmails: Email[] = [
  {
    id: '1',
    sender: 'researcher@university.edu',
    subject: 'New findings on mitochondrial dysfunction in CFS',
    date: new Date('2024-01-15T10:30:00'),
    preview: 'I wanted to share our latest research findings regarding mitochondrial dysfunction...',
    hasAttachments: true,
    urlCount: 3,
    isProcessed: true,
    importance: 3,
    isStarred: true,
  },
  {
    id: '2',
    sender: 'collaborator@research.org',
    subject: 'Re: Meeting notes - Oxidative stress markers',
    date: new Date('2024-01-14T15:45:00'),
    preview: 'Thanks for the meeting today. I\'ve attached the papers we discussed about oxidative...',
    hasAttachments: false,
    urlCount: 5,
    isProcessed: true,
    importance: 2,
    isStarred: false,
  },
  {
    id: '3',
    sender: 'journal@sciencepub.com',
    subject: 'Article accepted: Neuroinflammation in chronic fatigue',
    date: new Date('2024-01-13T09:15:00'),
    preview: 'We are pleased to inform you that your article has been accepted for publication...',
    hasAttachments: true,
    urlCount: 1,
    isProcessed: false,
    importance: 1,
    isStarred: false,
  },
];

interface EmailListProps {
  searchQuery: string;
}

function EmailList({ searchQuery }: EmailListProps) {
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'sender' | 'importance'>('date');

  const filteredEmails = mockEmails.filter(email => 
    email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
    email.preview.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleEmailSelection = (emailId: string) => {
    const newSelection = new Set(selectedEmails);
    if (newSelection.has(emailId)) {
      newSelection.delete(emailId);
    } else {
      newSelection.add(emailId);
    }
    setSelectedEmails(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedEmails.size === filteredEmails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredEmails.map(e => e.id)));
    }
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
        <div className="flex items-center gap-4">
          <input
            type="checkbox"
            checked={selectedEmails.size === filteredEmails.length && filteredEmails.length > 0}
            onChange={toggleAllSelection}
            className="w-4 h-4 text-primary-600 bg-background-elevated border-border rounded focus:ring-primary-500"
          />
          
          {selectedEmails.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-text-secondary">
                {selectedEmails.size} selected
              </span>
              <button className="btn btn-ghost text-sm">
                <Archive size={16} />
                Archive
              </button>
              <button className="btn btn-ghost text-sm">
                Process
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted">Sort by:</span>
          <button className="flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary">
            {sortBy === 'date' ? 'Date' : sortBy === 'sender' ? 'Sender' : 'Importance'}
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Email List */}
      <div className="space-y-1">
        {filteredEmails.map((email) => (
          <div
            key={email.id}
            className={`group flex items-start gap-3 p-3 rounded-lg hover:bg-background-elevated transition-colors cursor-pointer ${
              selectedEmails.has(email.id) ? 'bg-background-elevated' : ''
            }`}
          >
            <input
              type="checkbox"
              checked={selectedEmails.has(email.id)}
              onChange={() => toggleEmailSelection(email.id)}
              className="mt-1 w-4 h-4 text-primary-600 bg-background-elevated border-border rounded focus:ring-primary-500"
            />
            
            <button className={`mt-0.5 ${email.isStarred ? 'text-warning' : 'text-text-muted hover:text-text-secondary'}`}>
              <Star size={18} fill={email.isStarred ? 'currentColor' : 'none'} />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary truncate">
                      {email.sender}
                    </span>
                    {email.importance > 1 && (
                      <span className={`badge ${
                        email.importance === 3 ? 'badge-error' : 'badge-warning'
                      }`}>
                        Important
                      </span>
                    )}
                    {email.isProcessed && (
                      <span className="badge badge-success">Processed</span>
                    )}
                  </div>
                  
                  <h4 className="text-text-primary font-medium mt-1 truncate">
                    {email.subject}
                  </h4>
                  
                  <p className="text-sm text-text-muted mt-1 line-clamp-2">
                    {email.preview}
                  </p>
                  
                  <div className="flex items-center gap-4 mt-2">
                    {email.hasAttachments && (
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <Paperclip size={14} />
                        Attachments
                      </span>
                    )}
                    {email.urlCount > 0 && (
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <Link size={14} />
                        {email.urlCount} URLs
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 text-text-muted">
                  <span className="text-sm whitespace-nowrap">
                    {format(email.date, 'MMM d')}
                  </span>
                  <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-background-hover rounded transition-all">
                    <MoreVertical size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredEmails.length === 0 && (
        <div className="text-center py-12">
          <Mail size={48} className="mx-auto text-text-muted mb-4" />
          <p className="text-text-secondary">No emails found</p>
          <p className="text-text-muted text-sm mt-1">
            Try adjusting your search query
          </p>
        </div>
      )}
    </div>
  );
}

export default EmailList;