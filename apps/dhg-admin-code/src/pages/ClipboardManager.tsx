import React, { useState, useEffect } from 'react';
import { Copy, Check, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import DashboardLayout from '../components/DashboardLayout';

interface ClipboardItem {
  id: string;
  title: string;
  content: string;
  category?: string;
  lastUsed?: string;
}

export default function ClipboardManager() {
  const [items, setItems] = useState<ClipboardItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ title: '', content: '', category: '' });

  // Load items from localStorage
  useEffect(() => {
    const savedItems = localStorage.getItem('clipboardItems');
    if (savedItems) {
      setItems(JSON.parse(savedItems));
    } else {
      // Default items for Claude prompts
      setItems([
        {
          id: '1',
          title: 'Claude Context Reminder',
          content: `<system-reminder>
As you answer the user's questions, you can use the following context:
# claudeMd
Codebase and user instructions are shown below. Be sure to adhere to these instructions. IMPORTANT: These instructions OVERRIDE any default behavior and you MUST follow them exactly as written.

Contents of /Users/raybunnage/Documents/github/dhg-mono-improve-cli-pipelines/CLAUDE.md (project instructions, checked into the codebase):`,
          category: 'Claude Prompts'
        },
        {
          id: '2',
          title: 'Important Instruction Reminders',
          content: `# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
Please clean up any files that you've created for testing or debugging purposes after they're no longer needed.
      
      IMPORTANT: this context may or may not be relevant to your tasks. You should not respond to this context or otherwise consider it in your response unless it is highly relevant to your task. Most of the time, it is not relevant.`,
          category: 'Claude Prompts'
        }
      ]);
    }
  }, []);

  // Save items to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('clipboardItems', JSON.stringify(items));
  }, [items]);

  const copyToClipboard = async (item: ClipboardItem) => {
    try {
      await navigator.clipboard.writeText(item.content);
      setCopiedId(item.id);
      
      // Update last used time
      setItems(items.map(i => 
        i.id === item.id 
          ? { ...i, lastUsed: new Date().toISOString() }
          : i
      ));

      // Reset copied indicator after 2 seconds
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const addItem = () => {
    if (newItem.title && newItem.content) {
      const item: ClipboardItem = {
        id: Date.now().toString(),
        title: newItem.title,
        content: newItem.content,
        category: newItem.category || 'General'
      };
      setItems([...items, item]);
      setNewItem({ title: '', content: '', category: '' });
      setShowAddForm(false);
    }
  };

  const deleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const startEdit = (item: ClipboardItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
  };

  const saveEdit = () => {
    setItems(items.map(item => 
      item.id === editingId 
        ? { ...item, content: editContent }
        : item
    ));
    setEditingId(null);
    setEditContent('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    const category = item.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, ClipboardItem[]>);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Clipboard Manager</h1>
          <p className="text-gray-600">
            Manage frequently used text snippets. Click to copy to clipboard.
          </p>
        </div>

        {/* Add New Item Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add New Snippet
          </button>
        </div>

        {/* Add New Item Form */}
        {showAddForm && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold mb-4">Add New Snippet</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={newItem.title}
                  onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., API Key Template"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={newItem.category}
                  onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Claude Prompts"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <textarea
                  value={newItem.content}
                  onChange={(e) => setNewItem({ ...newItem, content: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  rows={6}
                  placeholder="Paste your text content here..."
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addItem}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Save Snippet
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewItem({ title: '', content: '', category: '' });
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Grouped Items */}
        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category} className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">{category}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categoryItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                    <div className="flex gap-1">
                      <button
                        onClick={() => startEdit(item)}
                        className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-1 text-gray-500 hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {editingId === item.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                        rows={4}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={saveEdit}
                          className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          <Save className="h-3 w-3" />
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3">
                        <pre className="text-xs text-gray-600 bg-gray-50 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                          {item.content.substring(0, 150)}
                          {item.content.length > 150 && '...'}
                        </pre>
                      </div>

                      <button
                        onClick={() => copyToClipboard(item)}
                        className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded transition-all ${
                          copiedId === item.id
                            ? 'bg-green-600 text-white'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {copiedId === item.id ? (
                          <>
                            <Check className="h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy to Clipboard
                          </>
                        )}
                      </button>

                      {item.lastUsed && (
                        <p className="text-xs text-gray-500 mt-2">
                          Last used: {new Date(item.lastUsed).toLocaleString()}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}