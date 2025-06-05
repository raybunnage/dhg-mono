import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Edit, Trash2, Search, Users, Info, BookOpen, FileText } from 'lucide-react';
import { supabase } from '../utils/supabase-adapter';
import { DashboardLayout } from '../components/DashboardLayout';

// Interface for expert profile based on supabase/types.ts
interface ExpertProfile {
  id: string;
  expert_name: string;
  full_name: string | null;
  mnemonic: string | null;
  is_in_core_group: boolean;
  metadata: any | null;
  created_at: string;
  updated_at: string;
}

// Interface for expert document statistics
interface ExpertDocumentStats {
  total_documents: number;
  document_types: { [key: string]: number };
  latest_document_date: string | null;
}

// Interface for expert learning data (future feature)
interface ExpertLearningData {
  total_topics: number;
  subject_areas: string[];
  learning_progress: number;
}

// Custom mnemonics map from the CLI
const CUSTOM_MNEMONICS: Record<string, string> = {
  'abcdedfghi': 'ABC',
  'abernathy': 'ABE',
  'abernethy': 'ABR',
  'aria, carter, patterson': 'ACP',
  'allison': 'ALL',
  'amster': 'AMS',
  'anderson': 'AND',
  'anonymous': 'ANO',
  'apkarian': 'APK',
  'aria': 'ARI',
  'arndt': 'ARN',
  'ashar': 'ASH',
  'baker': 'BAK',
  'barrett': 'BAR',
  'barsalou': 'BAS',
  'bezruchka': 'BEZ',
  'bunnage': 'BUN',
  'carter': 'CAR',
  'carter,clawson,hanscom': 'CCH',
  'carter clawson hanscom': 'CCH',
  'cook clawson': 'CCK',
  'carter, horn': 'CHN',
  'clark': 'CLK',
  'clauw': 'CLW',
  'clawson': 'CLW',
  'cole': 'COL',
  'constable': 'CON',
  'cook': 'COK',
  'dale': 'DAL',
  'dantzer': 'DAN',
  'dehaene': 'DEH',
  'duncan': 'DUN',
  'eagle': 'EAG',
  'eagle armster': 'EAR',
  'ebunnage': 'EBN',
  'eisenberger': 'EIS',
  'escalante': 'ESC',
  'fradkin': 'FRA',
  'friston': 'FRI',
  'garbo': 'GAR',
  'germer': 'GER',
  'gervitz': 'GEV',
  'gevirtz': 'GEZ',
  'grinevich': 'GRI',
  'halaris': 'HAL',
  'hanscom': 'HAN',
  'harris': 'HAR',
  'hanscom, clawson': 'HCL',
  'horn, carter': 'HCT',
  'horn': 'HRN',
  'porges': 'POR',
  'naviaux': 'NAV',
  'pennebaker': 'PEN',
  'siegel': 'SIG',
  'sullivan': 'SUL',
};

export function ExpertProfiles() {
  const [experts, setExperts] = useState<ExpertProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [documentCounts, setDocumentCounts] = useState<{ [expertId: string]: number }>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedExpert, setSelectedExpert] = useState<ExpertProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileExpert, setProfileExpert] = useState<ExpertProfile | null>(null);
  const [expertDocStats, setExpertDocStats] = useState<ExpertDocumentStats | null>(null);
  const [expertLearningData, setExpertLearningData] = useState<ExpertLearningData | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [formData, setFormData] = useState({
    expert_name: '',
    full_name: '',
    mnemonic: '',
    is_in_core_group: false,
    metadata: {}
  });

  // Generate mnemonic based on name
  const generateMnemonic = (name: string): string => {
    if (!name) return '';
    
    const nameLower = name.toLowerCase();
    
    // Check custom mnemonics first
    if (CUSTOM_MNEMONICS[nameLower]) {
      return CUSTOM_MNEMONICS[nameLower];
    }
    
    // Generate mnemonic
    const parts = name.split(/[\s\-\.]+/).filter(Boolean);
    let mnemonic = '';
    
    if (parts.length === 1) {
      mnemonic = parts[0].substring(0, 3).toUpperCase();
    } else if (parts.length === 2) {
      mnemonic = parts[0].substring(0, 2).toUpperCase() + parts[1].charAt(0).toUpperCase();
    } else {
      mnemonic = parts.slice(0, 3)
        .map(part => part.charAt(0).toUpperCase())
        .join('');
    }
    
    return mnemonic.padEnd(3, '0');
  };

  // Load experts
  const loadExperts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('expert_profiles')
        .select('*')
        .order('expert_name');

      if (error) throw error;

      setExperts(data || []);

      // Fetch document counts for all experts
      if (data && data.length > 0) {
        const expertIds = data.map(e => e.id);
        
        // Get document counts using google_sources_experts join table
        const { data: countsData, error: countsError } = await supabase
          .from('google_sources_experts')
          .select('expert_id')
          .in('expert_id', expertIds);

        if (!countsError && countsData) {
          // Count documents per expert
          const counts: { [expertId: string]: number } = {};
          countsData.forEach(row => {
            counts[row.expert_id] = (counts[row.expert_id] || 0) + 1;
          });
          setDocumentCounts(counts);
        }
      }
    } catch (error) {
      console.error('Error loading experts:', error);
      toast.error('Failed to load expert profiles');
    } finally {
      setLoading(false);
    }
  };

  // Create expert
  const createExpert = async () => {
    try {
      const mnemonic = formData.mnemonic || generateMnemonic(formData.expert_name);
      
      const { data, error } = await supabase
        .from('expert_profiles')
        .insert({
          ...formData,
          mnemonic,
          metadata: formData.metadata || {}
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Expert "${formData.expert_name}" created successfully`);
      setExperts([...experts, data]);
      setShowAddModal(false);
      resetForm();
      // Reload to get updated document counts
      loadExperts();
    } catch (error) {
      console.error('Error creating expert:', error);
      toast.error('Failed to create expert profile');
    }
  };

  // Update expert
  const updateExpert = async () => {
    if (!selectedExpert) return;

    try {
      const { data, error } = await supabase
        .from('expert_profiles')
        .update({
          expert_name: formData.expert_name,
          full_name: formData.full_name,
          mnemonic: formData.mnemonic,
          is_in_core_group: formData.is_in_core_group,
          metadata: formData.metadata
        })
        .eq('id', selectedExpert.id)
        .select()
        .single();

      if (error) throw error;

      toast.success(`Expert "${formData.expert_name}" updated successfully`);
      setExperts(experts.map(e => e.id === selectedExpert.id ? data : e));
      setShowEditModal(false);
      resetForm();
    } catch (error) {
      console.error('Error updating expert:', error);
      toast.error('Failed to update expert profile');
    }
  };

  // Fetch expert profile data
  const fetchExpertProfileData = async (expert: ExpertProfile) => {
    setLoadingProfile(true);
    setProfileExpert(expert);
    setExpertDocStats(null);
    setExpertLearningData(null);
    setShowProfileModal(true);

    try {
      // Fetch document statistics via google_sources_experts join
      const { data: docData, error: docError } = await supabase
        .from('google_sources_experts')
        .select(`
          source_id,
          google_sources!inner (
            id,
            name,
            mime_type,
            created_at
          )
        `)
        .eq('expert_id', expert.id);

      // Then fetch the expert documents separately
      let expertDocuments: Array<{
        source_id: string;
        document_type_id: string | null;
        document_types: { name: string } | null;
      }> = [];
      if (!docError && docData && docData.length > 0) {
        const sourceIds = docData.map(d => d.source_id);
        const { data: docsData, error: docsError } = await supabase
          .from('google_expert_documents')
          .select(`
            source_id,
            document_type_id,
            document_types (
              name
            )
          `)
          .in('source_id', sourceIds);
        
        if (!docsError && docsData) {
          expertDocuments = docsData;
        }
      }

      if (!docError && docData) {
        // Calculate document statistics
        const stats: ExpertDocumentStats = {
          total_documents: docData.length,
          document_types: {},
          latest_document_date: null
        };

        // Create a map of source_id to document type
        const docTypeMap: { [key: string]: string } = {};
        expertDocuments.forEach(doc => {
          docTypeMap[doc.source_id] = doc.document_types?.name || 'Unclassified';
        });

        // Count documents by type and track latest date
        docData.forEach(doc => {
          const typeName = docTypeMap[doc.source_id] || 'Unclassified';
          stats.document_types[typeName] = (stats.document_types[typeName] || 0) + 1;
          
          // Track latest document date
          const docDate = doc.google_sources?.created_at;
          if (docDate && (!stats.latest_document_date || docDate > stats.latest_document_date)) {
            stats.latest_document_date = docDate;
          }
        });

        setExpertDocStats(stats);
      }

      // TODO: In the future, fetch learning data from learn_* tables
      // For now, set placeholder data
      setExpertLearningData({
        total_topics: 0,
        subject_areas: [],
        learning_progress: 0
      });

    } catch (error) {
      console.error('Error fetching expert profile data:', error);
      toast.error('Failed to load expert profile data');
    } finally {
      setLoadingProfile(false);
    }
  };

  // Delete expert
  const deleteExpert = async (expert: ExpertProfile) => {
    if (!confirm(`Are you sure you want to delete "${expert.expert_name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('expert_profiles')
        .delete()
        .eq('id', expert.id);

      if (error) throw error;

      toast.success(`Expert "${expert.expert_name}" deleted successfully`);
      setExperts(experts.filter(e => e.id !== expert.id));
      // Update document counts
      const newCounts = { ...documentCounts };
      delete newCounts[expert.id];
      setDocumentCounts(newCounts);
    } catch (error) {
      console.error('Error deleting expert:', error);
      toast.error('Failed to delete expert profile');
    }
  };

  // Edit expert
  const editExpert = (expert: ExpertProfile) => {
    setSelectedExpert(expert);
    setFormData({
      expert_name: expert.expert_name,
      full_name: expert.full_name || '',
      mnemonic: expert.mnemonic || '',
      is_in_core_group: expert.is_in_core_group,
      metadata: expert.metadata || {}
    });
    setShowEditModal(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      expert_name: '',
      full_name: '',
      mnemonic: '',
      is_in_core_group: false,
      metadata: {}
    });
    setSelectedExpert(null);
  };

  // Filter experts by search term
  const filteredExperts = experts.filter(expert => 
    expert.expert_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expert.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expert.mnemonic?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Load experts on mount
  useEffect(() => {
    loadExperts();
  }, []);

  // Auto-generate mnemonic when expert name changes
  useEffect(() => {
    if (formData.expert_name && !formData.mnemonic) {
      setFormData(prev => ({
        ...prev,
        mnemonic: generateMnemonic(prev.expert_name)
      }));
    }
  }, [formData.expert_name]);

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Expert Profiles</h1>
        <p className="text-gray-600">Manage expert profiles and their metadata</p>
      </div>

      {/* Actions Bar */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search experts by name or mnemonic..."
                className="pl-10 pr-4 py-2 w-full border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              <Plus className="w-4 h-4" />
              Add Expert
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-500" />
            <span className="text-gray-600">{experts.length} total experts</span>
          </div>
        </div>
      </div>

      {/* Experts Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Mnemonic
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expert Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Full Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Core Group
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  Loading experts...
                </td>
              </tr>
            ) : filteredExperts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                  No experts found
                </td>
              </tr>
            ) : (
              filteredExperts.map((expert) => (
                <tr key={expert.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm font-medium">
                      {expert.mnemonic || '---'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      {expert.expert_name}
                      {documentCounts[expert.id] > 0 && (
                        <span 
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                          title={`${documentCounts[expert.id]} documents`}
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          {documentCounts[expert.id]}
                        </span>
                      )}
                      {expert.metadata && Object.keys(expert.metadata).length > 0 && (
                        <span 
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          title="Has profile metadata"
                        >
                          <Info className="w-3 h-3 mr-1" />
                          Meta
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                    {expert.full_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {expert.is_in_core_group ? (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                        Core
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                        Regular
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-sm">
                    {new Date(expert.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => fetchExpertProfileData(expert)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="View Profile Information"
                    >
                      <Info className="w-4 h-4 inline" />
                    </button>
                    <button
                      onClick={() => editExpert(expert)}
                      className="text-purple-600 hover:text-purple-900 mr-3"
                    >
                      <Edit className="w-4 h-4 inline" />
                    </button>
                    <button
                      onClick={() => deleteExpert(expert)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">
              {showAddModal ? 'Add New Expert' : 'Edit Expert'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expert Name *
                </label>
                <input
                  type="text"
                  value={formData.expert_name}
                  onChange={(e) => setFormData({ ...formData, expert_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Hanscom"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="e.g., Dr. Ray Hanscom"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mnemonic (3 letters)
                </label>
                <input
                  type="text"
                  value={formData.mnemonic}
                  onChange={(e) => setFormData({ ...formData, mnemonic: e.target.value.toUpperCase().slice(0, 3) })}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Auto-generated or custom"
                  maxLength={3}
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_in_core_group}
                    onChange={(e) => setFormData({ ...formData, is_in_core_group: e.target.checked })}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Core Group Member</span>
                </label>
              </div>
            </div>

            <div className="mt-6 flex gap-3 justify-end">
              <button
                onClick={() => {
                  showAddModal ? setShowAddModal(false) : setShowEditModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={showAddModal ? createExpert : updateExpert}
                disabled={!formData.expert_name}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                {showAddModal ? 'Create Expert' : 'Update Expert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Information Modal */}
      {showProfileModal && profileExpert && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Profile Information: {profileExpert.expert_name}
              </h3>
            </div>

            <div className="p-6">
              {loadingProfile ? (
                <div className="text-center py-8">
                  <div className="inline-flex items-center gap-2 text-gray-500">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>
                    Loading profile data...
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Basic Information */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Users className="w-5 h-5 text-purple-600" />
                      Basic Information
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Full Name:</span>
                        <span className="font-medium">{profileExpert.full_name || 'Not specified'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mnemonic:</span>
                        <span className="font-mono font-medium">{profileExpert.mnemonic}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Core Group:</span>
                        <span>{profileExpert.is_in_core_group ? 'Yes' : 'No'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Created:</span>
                        <span>{new Date(profileExpert.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Document Statistics */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Document Statistics
                    </h4>
                    {expertDocStats && expertDocStats.total_documents > 0 ? (
                      <div className="bg-blue-50 rounded-lg p-4">
                        <div className="mb-3">
                          <span className="text-gray-600">Total Documents:</span>
                          <span className="ml-2 font-semibold text-lg">{expertDocStats.total_documents}</span>
                        </div>
                        <div className="space-y-2">
                          <span className="text-gray-600 text-sm">Document Types:</span>
                          <div className="grid grid-cols-2 gap-2">
                            {Object.entries(expertDocStats.document_types).map(([type, count]) => (
                              <div key={type} className="bg-white rounded px-3 py-2 flex justify-between">
                                <span className="text-sm">{type}:</span>
                                <span className="font-medium text-sm">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {expertDocStats.latest_document_date && (
                          <div className="mt-3 text-sm text-gray-600">
                            Latest: {new Date(expertDocStats.latest_document_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-gray-50 rounded-lg p-4 text-gray-500 text-center">
                        No documents found for this expert
                      </div>
                    )}
                  </div>

                  {/* Learning Profile (Future Feature) */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-green-600" />
                      Learning Profile
                    </h4>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-gray-600 text-center">
                        <p className="mb-2">Learning profile features coming soon!</p>
                        <p className="text-sm">This will include topics, subject areas, and learning progress.</p>
                      </div>
                    </div>
                  </div>

                  {/* Metadata */}
                  {profileExpert.metadata && Object.keys(profileExpert.metadata).length > 0 && (
                    <div>
                      <h4 className="text-md font-semibold text-gray-900 mb-3">Metadata</h4>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <pre className="text-sm whitespace-pre-wrap">
                          {JSON.stringify(profileExpert.metadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end">
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setProfileExpert(null);
                  setExpertDocStats(null);
                  setExpertLearningData(null);
                }}
                className="px-4 py-2 border rounded-md hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}