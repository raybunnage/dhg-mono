import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, AlertCircle, CheckCircle, Database, Users, FileText, RefreshCw, Edit, Eye, Trash2, Plus, Search } from "lucide-react";
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import { ExpertInterface, ExpertDocument } from '@/types/expert';
import { ExpertForm } from '@/components/experts/ExpertForm';
import { ExpertDocumentForm } from '@/components/experts/ExpertDocumentForm';

export default function ExpertsDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'experts' | 'documents' | 'detail' | 'profiles'>('overview');
  const [loading, setLoading] = useState(true);
  const [experts, setExperts] = useState<ExpertInterface[]>([]);
  const [documents, setDocuments] = useState<ExpertDocument[]>([]);
  const [selectedExpert, setSelectedExpert] = useState<ExpertInterface | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<ExpertDocument | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showExpertForm, setShowExpertForm] = useState(false);
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [expertToEdit, setExpertToEdit] = useState<ExpertInterface | null>(null);
  const [documentToEdit, setDocumentToEdit] = useState<ExpertDocument | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'expert' | 'document', item: any } | null>(null);
  const [processingDocument, setProcessingDocument] = useState<ExpertDocument | null>(null);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalExperts: 0,
    coreExperts: 0,
    totalDocuments: 0,
    processedDocuments: 0,
    pendingDocuments: 0,
    failedDocuments: 0
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchExperts(),
        fetchDocuments(),
        fetchStats()
      ]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchExperts = async () => {
    try {
      const { data, error } = await supabase
        .from('experts')
        .select('*')
        .order('expert_name');

      if (error) throw error;
      setExperts(data || []);
    } catch (error) {
      console.error('Error fetching experts:', error);
      toast.error('Failed to load experts');
    }
  };

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('expert_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load expert documents');
    }
  };

  const fetchStats = async () => {
    try {
      // Get total experts count
      const { count: totalExperts } = await supabase
        .from('experts')
        .select('*', { count: 'exact', head: true });
      
      // Get core experts count
      const { count: coreExperts } = await supabase
        .from('experts')
        .select('*', { count: 'exact', head: true })
        .eq('is_in_core_group', true);
      
      // Get documents counts
      const { count: totalDocuments } = await supabase
        .from('expert_documents')
        .select('*', { count: 'exact', head: true });
      
      // Get processed documents count
      const { count: processedDocuments } = await supabase
        .from('expert_documents')
        .select('*', { count: 'exact', head: true })
        .eq('processing_status', 'completed');
      
      // Get pending documents count
      const { count: pendingDocuments } = await supabase
        .from('expert_documents')
        .select('*', { count: 'exact', head: true })
        .eq('processing_status', 'pending');
      
      // Get failed documents count
      const { count: failedDocuments } = await supabase
        .from('expert_documents')
        .select('*', { count: 'exact', head: true })
        .eq('processing_status', 'failed');
      
      setStats({
        totalExperts: totalExperts || 0,
        coreExperts: coreExperts || 0,
        totalDocuments: totalDocuments || 0,
        processedDocuments: processedDocuments || 0,
        pendingDocuments: pendingDocuments || 0,
        failedDocuments: failedDocuments || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const refreshData = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
      toast.success('Data refreshed successfully');
    } catch (error) {
      console.error('Error refreshing data:', error);
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Expert Actions
  const handleSelectExpert = (expert: ExpertInterface) => {
    setSelectedExpert(expert);
    setSelectedDocument(null);
    setActiveTab('detail');
  };

  const handleAddExpert = () => {
    setExpertToEdit(null);
    setShowExpertForm(true);
  };

  const handleEditExpert = (expert: ExpertInterface) => {
    setExpertToEdit(expert);
    setShowExpertForm(true);
  };

  const handleExpertFormSuccess = async (expert: ExpertInterface) => {
    setShowExpertForm(false);
    await fetchExperts();
    await fetchStats();
    
    // If we were editing the currently selected expert, update it
    if (selectedExpert && selectedExpert.id === expert.id) {
      setSelectedExpert(expert);
    }
    
    // If we were editing an expert in the edit form, clear it
    if (expertToEdit) {
      setExpertToEdit(null);
    }
  };

  const handleDeleteExpert = (expert: ExpertInterface) => {
    setConfirmDelete({ type: 'expert', item: expert });
  };

  const confirmExpertDelete = async () => {
    if (!confirmDelete || confirmDelete.type !== 'expert') return;
    
    const expert = confirmDelete.item as ExpertInterface;
    
    try {
      // First check if there are any documents associated with this expert
      const { count, error: countError } = await supabase
        .from('expert_documents')
        .select('*', { count: 'exact', head: true })
        .eq('expert_id', expert.id);
        
      if (countError) throw countError;
      
      if (count && count > 0) {
        toast.error(`Cannot delete expert with ${count} associated documents. Delete the documents first.`);
        setConfirmDelete(null);
        return;
      }
      
      const { error } = await supabase
        .from('experts')
        .delete()
        .eq('id', expert.id);
        
      if (error) throw error;
      
      toast.success('Expert deleted successfully');
      
      // If we were viewing the deleted expert, clear the selection
      if (selectedExpert && selectedExpert.id === expert.id) {
        setSelectedExpert(null);
        setActiveTab('experts');
      }
      
      // Refresh data
      await fetchExperts();
      await fetchStats();
    } catch (error) {
      console.error('Error deleting expert:', error);
      toast.error('Failed to delete expert');
    } finally {
      setConfirmDelete(null);
    }
  };

  // Document Actions
  const handleSelectDocument = (document: ExpertDocument) => {
    setSelectedDocument(document);
    setSelectedExpert(null);
    setActiveTab('detail');
  };

  const handleAddDocument = (expertId?: string) => {
    setDocumentToEdit(null);
    if (expertId) {
      // If adding from expert detail view, pre-select the expert
      setSelectedExpert(experts.find(e => e.id === expertId) || null);
    }
    setShowDocumentForm(true);
  };

  const handleEditDocument = (document: ExpertDocument) => {
    setDocumentToEdit(document);
    setShowDocumentForm(true);
  };

  const handleDocumentFormSuccess = async (document: ExpertDocument) => {
    setShowDocumentForm(false);
    await fetchDocuments();
    await fetchStats();
    
    // If we were editing the currently selected document, update it
    if (selectedDocument && selectedDocument.id === document.id) {
      setSelectedDocument(document);
    }
    
    // If we were editing a document in the edit form, clear it
    if (documentToEdit) {
      setDocumentToEdit(null);
    }
  };

  const handleDeleteDocument = (document: ExpertDocument) => {
    setConfirmDelete({ type: 'document', item: document });
  };

  const confirmDocumentDelete = async () => {
    if (!confirmDelete || confirmDelete.type !== 'document') return;
    
    const document = confirmDelete.item as ExpertDocument;
    
    try {
      const { error } = await supabase
        .from('expert_documents')
        .delete()
        .eq('id', document.id);
        
      if (error) throw error;
      
      toast.success('Document deleted successfully');
      
      // If we were viewing the deleted document, clear the selection
      if (selectedDocument && selectedDocument.id === document.id) {
        setSelectedDocument(null);
        setActiveTab('documents');
      }
      
      // Refresh data
      await fetchDocuments();
      await fetchStats();
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Failed to delete document');
    } finally {
      setConfirmDelete(null);
    }
  };

  // Document Processing
  const handleProcessDocument = async (document: ExpertDocument) => {
    try {
      setProcessingDocument(document);
      setProcessingStatus('processing');
      
      // Update document status to processing
      await supabase
        .from('expert_documents')
        .update({ processing_status: 'processing' })
        .eq('id', document.id);
      
      // Sample content for processing (for demo)
      const profileJson = {
        name: document.title?.split(' - ')[0] || 'Unknown Expert',
        title: "Professor of Research",
        affiliations: ["Example University", "Research Institute"],
        expertise: ["Machine Learning", "Artificial Intelligence", "Neural Networks"],
        education: [
          {
            institution: "Stanford University",
            degree: "PhD",
            field: "Computer Science",
            year: "2010"
          }
        ],
        bio: "Distinguished researcher with over 10 years of experience in the field of machine learning and artificial intelligence."
      };
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update the document with processed content
      const { error } = await supabase
        .from('expert_documents')
        .update({ 
          processed_content: profileJson,
          processing_status: 'completed',
          extraction_date: new Date().toISOString()
        })
        .eq('id', document.id);
        
      if (error) throw error;
      
      // Also update the expert record with some of this information
      if (document.expert_id) {
        await supabase
          .from('experts')
          .update({
            full_name: profileJson.name,
            expertise_area: profileJson.expertise.join(', '),
            bio: profileJson.bio
          })
          .eq('id', document.expert_id);
      }
      
      setProcessingStatus('success');
      toast.success('Document processed successfully');
      
      // Refresh data
      await fetchDocuments();
      await fetchStats();
      
      // If currently viewing the document, refresh it
      if (selectedDocument && selectedDocument.id === document.id) {
        const { data } = await supabase
          .from('expert_documents')
          .select('*')
          .eq('id', document.id)
          .single();
          
        if (data) {
          setSelectedDocument(data);
        }
      }
    } catch (error) {
      console.error('Error processing document:', error);
      setProcessingStatus('error');
      
      // Update document status to failed
      await supabase
        .from('expert_documents')
        .update({ processing_status: 'failed' })
        .eq('id', document.id);
        
      toast.error('Failed to process document');
    }
  };

  const filteredExperts = searchTerm
    ? experts.filter(expert => 
        expert.expert_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (expert.full_name && expert.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (expert.expertise_area && expert.expertise_area.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : experts;

  const filteredDocuments = searchTerm
    ? documents.filter(doc => 
        (doc.title && doc.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        doc.document_type.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : documents;
    
  const filteredProfiles = searchTerm
    ? documents.filter(doc => 
        doc.processing_status === 'completed' && 
        doc.processed_content !== null &&
        (
          // Search in document title
          (doc.title && doc.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
          // Search in profile name
          (doc.processed_content?.name && 
           doc.processed_content.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          // Search in expertise
          (doc.processed_content?.expertise && 
           doc.processed_content.expertise.some((e: string) => 
             e.toLowerCase().includes(searchTerm.toLowerCase())
           )) ||
          // Search in affiliations
          (doc.processed_content?.affiliations && 
           doc.processed_content.affiliations.some((a: string) => 
             a.toLowerCase().includes(searchTerm.toLowerCase())
           ))
        )
      )
    : documents.filter(doc => doc.processing_status === 'completed' && doc.processed_content !== null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600">Completed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-600">Processing</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Render Overview Dashboard
  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Experts</CardTitle>
            <CardDescription>Expert profiles in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.totalExperts}</div>
            <div className="text-sm text-gray-500 mt-2">
              {stats.coreExperts} Core experts
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => setActiveTab('experts')}
            >
              <Users className="h-4 w-4 mr-2" />
              Manage Experts
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Documents</CardTitle>
            <CardDescription>Expert-related documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold">{stats.totalDocuments}</div>
            <div className="text-sm text-gray-500 mt-2">
              {stats.processedDocuments} Processed, {stats.pendingDocuments} Pending
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={() => setActiveTab('documents')}
            >
              <FileText className="h-4 w-4 mr-2" />
              Manage Documents
            </Button>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Processing</CardTitle>
            <CardDescription>Document processing status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              <div className="h-8 w-full bg-gray-100 rounded-sm flex">
                <div 
                  className="bg-green-500 h-full rounded-l-sm"
                  style={{ width: `${stats.totalDocuments ? (stats.processedDocuments / stats.totalDocuments * 100) : 0}%` }}
                ></div>
                <div 
                  className="bg-blue-500 h-full"
                  style={{ width: `${stats.totalDocuments ? (stats.pendingDocuments / stats.totalDocuments * 100) : 0}%` }}
                ></div>
                <div 
                  className="bg-red-500 h-full rounded-r-sm"
                  style={{ width: `${stats.totalDocuments ? (stats.failedDocuments / stats.totalDocuments * 100) : 0}%` }}
                ></div>
              </div>
              <div className="text-sm text-gray-500 whitespace-nowrap">
                {stats.totalDocuments ? `${Math.round(stats.processedDocuments / stats.totalDocuments * 100)}%` : '0%'}
              </div>
            </div>
            <div className="flex mt-2 justify-between text-xs text-gray-500">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                Completed
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-1"></div>
                Pending
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                Failed
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-4"
              onClick={refreshData}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent Experts</CardTitle>
            <CardDescription>Recently added or updated experts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[320px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Expertise</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {experts.slice(0, 5).map(expert => (
                    <TableRow key={expert.id}>
                      <TableCell>
                        <div className="font-medium">{expert.expert_name}</div>
                        <div className="text-sm text-muted-foreground">{expert.full_name || '-'}</div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{expert.expertise_area || '-'}</TableCell>
                      <TableCell>
                        {expert.is_in_core_group && (
                          <Badge className="bg-green-600">Core</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleSelectExpert(expert)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {experts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-32 text-muted-foreground">
                        No experts found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {experts.length > 5 && (
              <div className="text-center mt-4">
                <Button variant="link" onClick={() => setActiveTab('experts')}>
                  View all experts
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Recent Documents</CardTitle>
            <CardDescription>Recently processed documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[320px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.slice(0, 5).map(document => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <div className="font-medium max-w-[200px] truncate">{document.title || 'Untitled'}</div>
                        <div className="text-sm text-muted-foreground">
                          {format(new Date(document.created_at), 'MMM d, yyyy')}
                        </div>
                      </TableCell>
                      <TableCell>{document.document_type}</TableCell>
                      <TableCell>{getStatusBadge(document.processing_status)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleSelectDocument(document)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {documents.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center h-32 text-muted-foreground">
                        No documents found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {documents.length > 5 && (
              <div className="text-center mt-4">
                <Button variant="link" onClick={() => setActiveTab('documents')}>
                  View all documents
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common expert management tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button onClick={handleAddExpert}>
              <Users className="mr-2 h-4 w-4" />
              Add New Expert
            </Button>
            <Button onClick={() => handleAddDocument()}>
              <FileText className="mr-2 h-4 w-4" />
              Add New Document
            </Button>
            <Button variant="outline" onClick={() => setActiveTab('experts')}>
              <Database className="mr-2 h-4 w-4" />
              View All Experts
            </Button>
            <Button variant="outline" onClick={() => setActiveTab('documents')}>
              <Database className="mr-2 h-4 w-4" />
              View All Documents
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Render Experts Tab
  const renderExperts = () => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Expert Management</CardTitle>
            <CardDescription>Manage expert profiles and information</CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={refreshData}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={handleAddExpert}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expert
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative flex w-full max-w-sm items-center mb-4">
          <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search experts..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Expert Name</TableHead>
                <TableHead>Full Name</TableHead>
                <TableHead>Expertise</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExperts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                    {searchTerm ? 'No experts match your search' : 'No experts found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredExperts.map(expert => (
                  <TableRow key={expert.id}>
                    <TableCell className="font-medium">{expert.expert_name}</TableCell>
                    <TableCell>{expert.full_name || '-'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{expert.expertise_area || '-'}</TableCell>
                    <TableCell>{expert.experience_years ? `${expert.experience_years} years` : '-'}</TableCell>
                    <TableCell>
                      {expert.is_in_core_group && (
                        <Badge className="bg-green-600">Core</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleSelectExpert(expert)} title="View">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEditExpert(expert)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteExpert(expert)} title="Delete">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  // Render Documents Tab
  const renderDocuments = () => (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Document Management</CardTitle>
            <CardDescription>Manage expert documents and content</CardDescription>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="icon"
              onClick={refreshData}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => handleAddDocument()}>
              <Plus className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative flex w-full max-w-sm items-center mb-4">
          <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Expert</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                    {searchTerm ? 'No documents match your search' : 'No documents found'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredDocuments.map(document => {
                  const expertName = experts.find(e => e.id === document.expert_id)?.expert_name || '-';
                  
                  return (
                    <TableRow key={document.id}>
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {document.title || 'Untitled Document'}
                      </TableCell>
                      <TableCell>{expertName}</TableCell>
                      <TableCell>{document.document_type}</TableCell>
                      <TableCell>{format(new Date(document.created_at), 'MMM d, yyyy')}</TableCell>
                      <TableCell>{getStatusBadge(document.processing_status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleSelectDocument(document)} title="View">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditDocument(document)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteDocument(document)} title="Delete">
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );

  // Render Profiles Tab
  const renderProfiles = () => {

    return (
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Expert Profiles</CardTitle>
              <CardDescription>Processed expert profiles from documents</CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="icon"
                onClick={refreshData}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative flex w-full max-w-sm items-center mb-4">
            <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search profiles..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {filteredProfiles.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              {searchTerm ? 'No profiles match your search' : 'No processed profiles found'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProfiles.map(document => {
                const expertName = experts.find(e => e.id === document.expert_id)?.expert_name || 'Unknown Expert';
                const profile = document.processed_content;
                
                // Skip if processed_content isn't a valid object
                if (!profile || typeof profile !== 'object') return null;
                
                return (
                  <Card key={document.id} className="overflow-hidden">
                    <CardHeader className="pb-2 bg-gray-50">
                      <CardTitle className="text-lg">{profile.name || document.title || 'Unnamed Profile'}</CardTitle>
                      <CardDescription>
                        {profile.title || expertName}
                        {profile.affiliations && profile.affiliations.length > 0 && (
                          <span> • {profile.affiliations[0]}</span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <ScrollArea className="h-80">
                        <div className="space-y-4">
                          {profile.expertise && profile.expertise.length > 0 && (
                            <div>
                              <div className="text-sm font-medium text-muted-foreground mb-1">Expertise</div>
                              <div className="flex flex-wrap gap-1">
                                {profile.expertise.map((item: string, i: number) => (
                                  <Badge key={i} variant="outline">{item}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {profile.education && profile.education.length > 0 && (
                            <div>
                              <div className="text-sm font-medium text-muted-foreground mb-1">Education</div>
                              {profile.education.map((edu: any, i: number) => (
                                <div key={i} className="text-sm mb-2 pl-2 border-l-2 border-gray-200">
                                  <div className="font-medium">{edu.degree} in {edu.field}</div>
                                  <div>{edu.institution}, {edu.year}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          
                          {profile.bio && (
                            <div>
                              <div className="text-sm font-medium text-muted-foreground mb-1">Biography</div>
                              <div className="text-sm">{profile.bio}</div>
                            </div>
                          )}
                          
                          <div>
                            <div className="text-sm font-medium text-muted-foreground mb-1">Raw JSON</div>
                            <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
                              {JSON.stringify(profile, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Render Detail View
  const renderDetail = () => {
    // Expert Detail View
    if (selectedExpert) {
      // Get documents for this expert
      const expertDocuments = documents.filter(doc => doc.expert_id === selectedExpert.id);
      
      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{selectedExpert.expert_name}</h2>
              {selectedExpert.full_name && (
                <p className="text-muted-foreground">{selectedExpert.full_name}</p>
              )}
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setActiveTab('experts')}>
                Back to Experts
              </Button>
              <Button onClick={() => handleEditExpert(selectedExpert)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Expert
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Expert Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Email</div>
                    <div>{selectedExpert.email_address || '-'}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Experience</div>
                    <div>{selectedExpert.experience_years ? `${selectedExpert.experience_years} years` : '-'}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-muted-foreground">Expertise Areas</div>
                    <div>{selectedExpert.expertise_area || '-'}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-muted-foreground">Status</div>
                    <div className="flex items-center">
                      {selectedExpert.is_in_core_group ? (
                        <Badge className="bg-green-600">Core Expert</Badge>
                      ) : (
                        <Badge variant="outline">Regular Expert</Badge>
                      )}
                    </div>
                  </div>
                </div>
                
                {selectedExpert.bio && (
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Biography</div>
                    <ScrollArea className="h-48 rounded-md border p-4">
                      <div className="text-sm">{selectedExpert.bio}</div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Expert Documents</CardTitle>
                  <Button size="sm" onClick={() => handleAddDocument(selectedExpert.id)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Document
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expertDocuments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center h-16 text-muted-foreground">
                            No documents found for this expert
                          </TableCell>
                        </TableRow>
                      ) : (
                        expertDocuments.map(document => (
                          <TableRow key={document.id}>
                            <TableCell className="font-medium">
                              <div className="max-w-[200px] truncate">{document.title || 'Untitled'}</div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(document.created_at), 'MMM d, yyyy')}
                              </div>
                            </TableCell>
                            <TableCell>{document.document_type}</TableCell>
                            <TableCell>{getStatusBadge(document.processing_status)}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleSelectDocument(document)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }
    
    // Document Detail View
    if (selectedDocument) {
      const expertName = experts.find(e => e.id === selectedDocument.expert_id)?.expert_name || '-';
      
      return (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold max-w-2xl truncate">
                {selectedDocument.title || 'Untitled Document'}
              </h2>
              <p className="text-muted-foreground">
                {expertName} • {selectedDocument.document_type}
              </p>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setActiveTab('documents')}>
                Back to Documents
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleProcessDocument(selectedDocument)}
                disabled={selectedDocument.processing_status === 'processing'}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Process Document
              </Button>
              <Button onClick={() => handleEditDocument(selectedDocument)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Document
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Document Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Status</div>
                      <div>{getStatusBadge(selectedDocument.processing_status)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Expert</div>
                      <div className="font-medium">{expertName}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Created</div>
                      <div>{format(new Date(selectedDocument.created_at), 'MMM d, yyyy h:mm a')}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Extraction Date</div>
                      <div>
                        {selectedDocument.extraction_date 
                          ? format(new Date(selectedDocument.extraction_date), 'MMM d, yyyy h:mm a')
                          : '-'}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Raw Content</div>
                    <ScrollArea className="h-64 rounded-md border p-4">
                      <div className="text-sm font-mono whitespace-pre-wrap">
                        {selectedDocument.raw_content || 'No raw content available'}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Processed Content</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDocument.processing_status === 'completed' && selectedDocument.processed_content ? (
                  <ScrollArea className="h-[400px] rounded-md border p-4">
                    {typeof selectedDocument.processed_content === 'string' ? (
                      <pre className="text-sm whitespace-pre-wrap">
                        {selectedDocument.processed_content}
                      </pre>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <div className="text-sm font-medium text-muted-foreground mb-1">Name</div>
                          <div className="font-bold">
                            {selectedDocument.processed_content.name}
                          </div>
                        </div>
                        
                        {selectedDocument.processed_content.title && (
                          <div>
                            <div className="text-sm font-medium text-muted-foreground mb-1">Title</div>
                            <div>{selectedDocument.processed_content.title}</div>
                          </div>
                        )}
                        
                        {selectedDocument.processed_content.affiliations && (
                          <div>
                            <div className="text-sm font-medium text-muted-foreground mb-1">Affiliations</div>
                            <ul className="list-disc pl-5">
                              {selectedDocument.processed_content.affiliations.map((item: string, i: number) => (
                                <li key={i} className="text-sm">{item}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {selectedDocument.processed_content.expertise && (
                          <div>
                            <div className="text-sm font-medium text-muted-foreground mb-1">Expertise</div>
                            <div className="flex flex-wrap gap-1">
                              {selectedDocument.processed_content.expertise.map((item: string, i: number) => (
                                <Badge key={i} variant="outline">{item}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {selectedDocument.processed_content.education && (
                          <div>
                            <div className="text-sm font-medium text-muted-foreground mb-1">Education</div>
                            {selectedDocument.processed_content.education.map((edu: any, i: number) => (
                              <div key={i} className="text-sm mb-2 pl-2 border-l-2 border-gray-200">
                                <div className="font-medium">{edu.degree} in {edu.field}</div>
                                <div>{edu.institution}, {edu.year}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {selectedDocument.processed_content.bio && (
                          <div>
                            <div className="text-sm font-medium text-muted-foreground mb-1">Biography</div>
                            <div className="text-sm">{selectedDocument.processed_content.bio}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </ScrollArea>
                ) : selectedDocument.processing_status === 'processing' ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Processing document...</p>
                  </div>
                ) : selectedDocument.processing_status === 'failed' ? (
                  <Alert variant="destructive" className="mb-4">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Processing Failed</AlertTitle>
                    <AlertDescription>
                      The document processing failed. Please try again.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <p className="text-muted-foreground mb-4">
                      This document has not been processed yet.
                    </p>
                    <Button onClick={() => handleProcessDocument(selectedDocument)}>
                      Process Document
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }
    
    // Default to experts list if nothing selected
    return renderExperts();
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-600">Loading experts dashboard...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6 flex items-center">
        <Users className="mr-2 h-8 w-8 text-blue-500" />
        Experts Dashboard
      </h1>
      
      <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as any)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="experts">Experts</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="detail" disabled={!selectedExpert && !selectedDocument}>
            {selectedExpert ? 'Expert Detail' : selectedDocument ? 'Document Detail' : 'Detail View'}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview">{renderOverview()}</TabsContent>
        <TabsContent value="experts">{renderExperts()}</TabsContent>
        <TabsContent value="documents">{renderDocuments()}</TabsContent>
        <TabsContent value="profiles">{renderProfiles()}</TabsContent>
        <TabsContent value="detail">{renderDetail()}</TabsContent>
      </Tabs>
      
      {/* Expert Form Dialog */}
      <Dialog open={showExpertForm} onOpenChange={setShowExpertForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{expertToEdit ? 'Edit Expert' : 'Add New Expert'}</DialogTitle>
            <DialogDescription>
              {expertToEdit 
                ? 'Update the expert\'s information below' 
                : 'Fill out the form below to add a new expert'}
            </DialogDescription>
          </DialogHeader>
          <ExpertForm
            expert={expertToEdit || undefined}
            onSuccess={handleExpertFormSuccess}
            onCancel={() => setShowExpertForm(false)}
          />
        </DialogContent>
      </Dialog>
      
      {/* Document Form Dialog */}
      <Dialog open={showDocumentForm} onOpenChange={setShowDocumentForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{documentToEdit ? 'Edit Document' : 'Add New Document'}</DialogTitle>
            <DialogDescription>
              {documentToEdit 
                ? 'Update the document information below' 
                : 'Fill out the form below to add a new document'}
            </DialogDescription>
          </DialogHeader>
          <ExpertDocumentForm
            document={documentToEdit || undefined}
            expertId={selectedExpert?.id}
            onSuccess={handleDocumentFormSuccess}
            onCancel={() => setShowDocumentForm(false)}
          />
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              {confirmDelete?.type === 'expert'
                ? 'Are you sure you want to delete this expert? This action cannot be undone.'
                : 'Are you sure you want to delete this document? This action cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDelete?.type === 'expert' ? confirmExpertDelete() : confirmDocumentDelete()}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}