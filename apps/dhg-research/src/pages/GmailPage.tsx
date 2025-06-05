import { useState } from 'react';
import { RefreshCw, Plus, Search, Filter, Download } from 'lucide-react';
import EmailList from '../components/gmail/EmailList';
import EmailSync from '../components/gmail/EmailSync';
import ImportantAddresses from '../components/gmail/ImportantAddresses';
import EmailAnalytics from '../components/gmail/EmailAnalytics';

type TabType = 'emails' | 'sync' | 'addresses' | 'analytics';

function GmailPage() {
  const [activeTab, setActiveTab] = useState<TabType>('emails');
  const [searchQuery, setSearchQuery] = useState('');

  const tabs = [
    { id: 'emails' as const, label: 'Emails', count: 1234 },
    { id: 'sync' as const, label: 'Sync' },
    { id: 'addresses' as const, label: 'Important Addresses' },
    { id: 'analytics' as const, label: 'Analytics' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-text-primary">Gmail Research Hub</h2>
          <p className="text-text-secondary mt-1">
            Manage and analyze research-related emails
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="btn btn-secondary">
            <Download size={18} />
            <span>Export</span>
          </button>
          <button className="btn btn-primary">
            <RefreshCw size={18} />
            <span>Sync Now</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
        <input
          type="text"
          placeholder="Search emails, URLs, or concepts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input pl-12 pr-12"
        />
        <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-background-hover transition-colors">
          <Filter size={18} className="text-text-muted" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-background-paper rounded-lg border border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-primary-800 text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-background-elevated'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activeTab === tab.id
                  ? 'bg-primary-700'
                  : 'bg-background-elevated'
              }`}>
                {tab.count.toLocaleString()}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="card">
        {activeTab === 'emails' && <EmailList searchQuery={searchQuery} />}
        {activeTab === 'sync' && <EmailSync />}
        {activeTab === 'addresses' && <ImportantAddresses />}
        {activeTab === 'analytics' && <EmailAnalytics />}
      </div>
    </div>
  );
}

export default GmailPage;