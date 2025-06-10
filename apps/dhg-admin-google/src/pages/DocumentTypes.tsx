import { useState, useEffect } from 'react';
import { 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  Hash,
  Calendar,
  Tag,
  Sparkles,
  X,
  Save,
  Copy
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../lib/supabase';

interface DocumentType {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  is_general_type: boolean | null;
  is_ai_generated: boolean | null;
  mnemonic: string | null;
  prompt_id: string | null;
  expected_json_schema: any | null;
  created_at: string | null;
  updated_at: string | null;
}

interface CategoryGroup {
  name: string;
  generalType: DocumentType | null;
  specificTypes: DocumentType[];
  isExpanded: boolean;
}

interface EditFormData {
  id?: string;
  name: string;
  category: string;
  description: string;
  is_general_type: boolean;
  is_ai_generated: boolean;
  mnemonic: string;
  prompt_id: string;
  expected_json_schema: string;
}

export function DocumentTypes() {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingType, setEditingType] = useState<DocumentType | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<EditFormData>({
    name: '',
    category: '',
    description: '',
    is_general_type: false,
    is_ai_generated: false,
    mnemonic: '',
    prompt_id: '',
    expected_json_schema: ''
  });
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  useEffect(() => {
    groupDocumentTypes();
  }, [documentTypes, searchQuery, selectedCategory]);

  const fetchDocumentTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .order('category', { ascending: true })
        .order('is_general_type', { ascending: false })
        .order('name', { ascending: true });

      if (error) throw error;
      setDocumentTypes(data || []);
    } catch (error) {
      console.error('Error fetching document types:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupDocumentTypes = () => {
    const groups: { [key: string]: CategoryGroup } = {};

    // Filter by search and category
    let filtered = documentTypes;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(dt => 
        dt.name.toLowerCase().includes(query) ||
        dt.category?.toLowerCase().includes(query) ||
        dt.description?.toLowerCase().includes(query) ||
        dt.mnemonic?.toLowerCase().includes(query)
      );
    }
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(dt => dt.category === selectedCategory);
    }

    // Group by category
    filtered.forEach(dt => {
      const category = dt.category || 'Uncategorized';
      
      if (!groups[category]) {
        groups[category] = {
          name: category,
          generalType: null,
          specificTypes: [],
          isExpanded: false
        };
      }

      if (dt.is_general_type) {
        groups[category].generalType = dt;
      } else {
        groups[category].specificTypes.push(dt);
      }
    });

    // Convert to array and sort
    const sortedGroups = Object.values(groups).sort((a, b) => 
      a.name.localeCompare(b.name)
    );

    setCategoryGroups(sortedGroups);
  };

  const toggleCategory = (categoryName: string) => {
    setCategoryGroups(prev => 
      prev.map(group => 
        group.name === categoryName 
          ? { ...group, isExpanded: !group.isExpanded }
          : group
      )
    );
  };

  const handleCreate = () => {
    setFormData({
      name: '',
      category: '',
      description: '',
      is_general_type: false,
      is_ai_generated: false,
      mnemonic: '',
      prompt_id: '',
      expected_json_schema: ''
    });
    setNewCategoryName(''); // Reset new category name when creating
    setShowCreateModal(true);
  };

  const handleEdit = (type: DocumentType) => {
    setEditingType(type);
    setFormData({
      id: type.id,
      name: type.name,
      category: type.category || '',
      description: type.description || '',
      is_general_type: type.is_general_type || false,
      is_ai_generated: type.is_ai_generated || false,
      mnemonic: type.mnemonic || '',
      prompt_id: type.prompt_id || '',
      expected_json_schema: type.expected_json_schema ? JSON.stringify(type.expected_json_schema, null, 2) : ''
    });
    setNewCategoryName(''); // Reset new category name when editing
    setShowEditModal(true);
  };

  const handleDelete = async (id: string) => {
    if (deleteConfirm !== id) {
      setDeleteConfirm(id);
      // Auto-clear confirmation after 5 seconds
      setTimeout(() => setDeleteConfirm(null), 5000);
      return;
    }

    try {
      const { error } = await supabase
        .from('document_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchDocumentTypes();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting document type:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Parse JSON schema if provided
      let jsonSchema = null;
      if (formData.expected_json_schema) {
        try {
          jsonSchema = JSON.parse(formData.expected_json_schema);
        } catch (e) {
          alert('Invalid JSON schema format');
          return;
        }
      }

      // Handle new category case
      const categoryValue = formData.category === '__new__' ? newCategoryName.trim() : formData.category.trim();
      
      const data = {
        name: formData.name.trim(),
        category: categoryValue || null,
        description: formData.description.trim() || null,
        is_general_type: formData.is_general_type,
        is_ai_generated: formData.is_ai_generated,
        mnemonic: formData.mnemonic.trim() || null,
        prompt_id: formData.prompt_id.trim() || null,
        expected_json_schema: jsonSchema
      };

      if (editingType) {
        // Update existing
        const { error } = await supabase
          .from('document_types')
          .update(data)
          .eq('id', editingType.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('document_types')
          .insert(data);

        if (error) throw error;
      }

      await fetchDocumentTypes();
      setShowCreateModal(false);
      setShowEditModal(false);
      setEditingType(null);
      setNewCategoryName('');
    } catch (error) {
      console.error('Error saving document type:', error);
      alert('Error saving document type. Please check the console for details.');
    }
  };

  const handleDuplicate = (type: DocumentType) => {
    setFormData({
      name: `${type.name} (Copy)`,
      category: type.category || '',
      description: type.description || '',
      is_general_type: false, // Always create as specific type when duplicating
      is_ai_generated: type.is_ai_generated || false,
      mnemonic: '',
      prompt_id: type.prompt_id || '',
      expected_json_schema: type.expected_json_schema ? JSON.stringify(type.expected_json_schema, null, 2) : ''
    });
    setNewCategoryName(''); // Reset new category name when duplicating
    setShowCreateModal(true);
  };

  // Get unique categories for filter
  const categories = Array.from(new Set(documentTypes.map(dt => dt.category).filter(Boolean))) as string[];

  // Calculate stats
  const totalTypes = documentTypes.length;
  const generalTypes = documentTypes.filter(dt => dt.is_general_type).length;
  const specificTypes = documentTypes.filter(dt => !dt.is_general_type).length;
  const aiGenerated = documentTypes.filter(dt => dt.is_ai_generated).length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-700">Loading document types...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div>
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Document Types</h1>
          <p className="text-gray-600">Manage document type definitions with general categories and specific types</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-gray-900">{totalTypes}</div>
                <div className="text-sm text-gray-700">Total Types</div>
              </div>
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-blue-900">{generalTypes}</div>
                <div className="text-sm text-gray-700">General Types</div>
              </div>
              <FolderOpen className="h-8 w-8 text-blue-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-green-900">{specificTypes}</div>
                <div className="text-sm text-gray-700">Specific Types</div>
              </div>
              <FileText className="h-8 w-8 text-green-400" />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold text-purple-900">{aiGenerated}</div>
                <div className="text-sm text-gray-700">AI Generated</div>
              </div>
              <Sparkles className="h-8 w-8 text-purple-400" />
            </div>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search document types..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-gray-50 focus:bg-white transition-colors"
              />
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 bg-gray-50 focus:bg-white transition-colors"
              >
                <option value="all">All Categories</option>
                {categories.sort().map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Create Button */}
            <div className="flex justify-end">
              <button
                onClick={handleCreate}
                className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                New Document Type
              </button>
            </div>
          </div>
        </div>

        {/* Document Types List */}
        <div className="space-y-4">
          {categoryGroups.map(group => (
            <div key={group.name} className="bg-white rounded-lg shadow-sm border border-gray-100">
              {/* Category Header */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors relative group"
                onClick={() => toggleCategory(group.name)}
                title={!group.isExpanded && group.generalType?.description ? group.generalType.description : undefined}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {group.isExpanded ? (
                      <ChevronDown className="h-5 w-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-5 w-5 text-gray-500" />
                    )}
                    <h3 className="text-lg font-semibold text-gray-900">{group.name}</h3>
                    <span className="text-sm text-gray-500">
                      ({group.specificTypes.length + (group.generalType ? 1 : 0)} types)
                    </span>
                  </div>
                  {group.generalType && (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-200">
                        General Type
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(group.generalType!);
                        }}
                        className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(group.generalType!.id);
                        }}
                        className={`p-1.5 rounded transition-colors ${
                          deleteConfirm === group.generalType.id
                            ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
                {group.generalType?.description && group.isExpanded && (
                  <p className="mt-2 ml-8 text-sm text-gray-600">
                    {group.generalType.description}
                  </p>
                )}
                {/* Tooltip for collapsed state */}
                {!group.isExpanded && group.generalType?.description && (
                  <div className="absolute z-10 invisible group-hover:visible bg-gray-900 text-white text-sm rounded-lg p-3 max-w-md mt-1 left-4 top-full shadow-lg">
                    <div className="absolute -top-2 left-6 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[8px] border-b-gray-900"></div>
                    {group.generalType.description}
                  </div>
                )}
              </div>

              {/* Specific Types */}
              {group.isExpanded && group.specificTypes.length > 0 && (
                <div className="border-t border-gray-100">
                  {group.specificTypes.map(type => (
                    <div key={type.id} className="p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-b-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900">{type.name}</h4>
                            {type.mnemonic && (
                              <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-mono">
                                {type.mnemonic}
                              </span>
                            )}
                            {type.is_ai_generated && (
                              <span className="inline-flex items-center px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs">
                                <Sparkles className="h-3 w-3 mr-1" />
                                AI
                              </span>
                            )}
                          </div>
                          {type.description && (
                            <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            {type.created_at && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(type.created_at).toLocaleDateString()}
                              </span>
                            )}
                            {type.prompt_id && (
                              <span className="flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                Has Prompt
                              </span>
                            )}
                            {type.expected_json_schema && (
                              <span className="flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                Has Schema
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 ml-4">
                          <button
                            onClick={() => handleDuplicate(type)}
                            className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                            title="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(type)}
                            className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(type.id)}
                            className={`p-1.5 rounded transition-colors ${
                              deleteConfirm === type.id
                                ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
                                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                            }`}
                            title={deleteConfirm === type.id ? 'Click again to confirm' : 'Delete'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {categoryGroups.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-600 border border-gray-100">
            No document types found matching your criteria
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || showEditModal) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingType ? 'Edit Document Type' : 'Create Document Type'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setShowEditModal(false);
                      setEditingType(null);
                      setNewCategoryName('');
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Category *
                      </label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                        required
                      >
                        <option value="">Select a category...</option>
                        {categories.sort().map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="__new__">+ Add new category</option>
                      </select>
                      {formData.category === '__new__' && (
                        <input
                          type="text"
                          value={newCategoryName}
                          placeholder="Enter new category name"
                          className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          autoFocus
                          required
                        />
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                      placeholder="Detailed description of this document type..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Mnemonic (3-char code)
                      </label>
                      <input
                        type="text"
                        value={formData.mnemonic}
                        onChange={(e) => setFormData({ ...formData, mnemonic: e.target.value.toUpperCase().slice(0, 3) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 font-mono"
                        placeholder="ABC"
                        maxLength={3}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Prompt ID
                      </label>
                      <input
                        type="text"
                        value={formData.prompt_id}
                        onChange={(e) => setFormData({ ...formData, prompt_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                        placeholder="UUID of associated prompt"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_general_type}
                        onChange={(e) => setFormData({ ...formData, is_general_type: e.target.checked })}
                        className="mr-2 h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">General Type (Category)</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_ai_generated}
                        onChange={(e) => setFormData({ ...formData, is_ai_generated: e.target.checked })}
                        className="mr-2 h-4 w-4 text-gray-600 focus:ring-gray-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">AI Generated</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expected JSON Schema
                    </label>
                    <textarea
                      value={formData.expected_json_schema}
                      onChange={(e) => setFormData({ ...formData, expected_json_schema: e.target.value })}
                      rows={6}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 font-mono text-sm"
                      placeholder='{"type": "object", "properties": {...}}'
                    />
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setShowEditModal(false);
                        setEditingType(null);
                        setNewCategoryName('');
                      }}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {editingType ? 'Update' : 'Create'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}