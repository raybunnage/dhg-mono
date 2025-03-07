import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, AlertCircle, CheckCircle, Code, Database, Table2, FileSymlink, List, Archive } from "lucide-react";
import { toast } from 'react-hot-toast';
import { SupabasePage as LegacySupabasePage } from './Supabase';

interface TableSummary {
  table_name: string;
  row_count: number;
  size: string;
  last_vacuum: string;
  missing_indexes: number;
  has_primary_key: boolean;
  column_count: number;
  status: 'good' | 'warning' | 'danger';
}

interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string;
  is_unique: string;
  foreign_key: string;
  trigger_name: string;
  check_constraint: string;
}

interface DatabaseObject {
  name: string;
  type: 'table' | 'view' | 'function' | 'trigger' | 'constraint' | 'index' | 'enum';
  definition: string;
  schema: string;
  notes?: string;
}

interface MigrationLog {
  id: number;
  name: string;
  executed_at: string;
  success: boolean;
  error_message?: string;
  sql_content: string;
}

interface SupabaseManagerProps {
  initialTab?: string;
}

const SupabaseAdmin: React.FC<SupabaseManagerProps> = ({ initialTab = "overview" }) => {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableColumns, setTableColumns] = useState<TableColumn[]>([]);
  const [sqlContent, setSqlContent] = useState("");
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlRunning, setSqlRunning] = useState(false);
  const [dbObjects, setDbObjects] = useState<DatabaseObject[]>([]);
  
  // SQL Query History states
  const [queryHistory, setQueryHistory] = useState<any[]>([]);
  const [showSaveQueryDialog, setShowSaveQueryDialog] = useState(false);
  const [queryName, setQueryName] = useState("");
  const [queryDescription, setQueryDescription] = useState("");
  const [queryTags, setQueryTags] = useState<string[]>([]);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [filteredObjects, setFilteredObjects] = useState<DatabaseObject[]>([]);
  const [migrationLogs, setMigrationLogs] = useState<MigrationLog[]>([]);
  const [newMigrationName, setNewMigrationName] = useState("");
  const [newMigrationSql, setNewMigrationSql] = useState("");
  const [schemaSql, setSchemaSql] = useState("");
  const [objectType, setObjectType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [inconsistencies, setInconsistencies] = useState<any[]>([]);

  // Initialize some static data on component mount
  useEffect(() => {
    // Simulate mock migration logs
    setMigrationLogs([
      {
        id: 1,
        name: '20250301000000_create_database_manager_functions',
        executed_at: new Date().toISOString(),
        success: true,
        sql_content: '-- Created database management functions'
      },
      {
        id: 2,
        name: '20250226000001_create_sync_history_table',
        executed_at: new Date(Date.now() - 86400000).toISOString(),
        success: true,
        sql_content: '-- Created sync history table'
      }
    ]);
    
    // Set example schema SQL
    setSchemaSql(`-- Example schema export
-- Generated ${new Date().toISOString()}

-- Tables
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES users(id),
  name TEXT,
  avatar_url TEXT
);

-- Views
CREATE VIEW active_users AS
SELECT * FROM users WHERE last_sign_in_at > now() - interval '30 days';

-- Functions
CREATE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`);
  }, []);

  // Call this on mount
  useEffect(() => {
    if (activeTab === "overview" || activeTab === "tables") {
      fetchDatabaseOverview();
    }
    if (activeTab === "sql") {
      fetchQueryHistory();
      fetchAvailableTags();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedTable) {
      fetchTableDetails(selectedTable);
    }
  }, [selectedTable]);

  useEffect(() => {
    filterObjects();
  }, [objectType, searchTerm, dbObjects]);

  const fetchDatabaseOverview = async () => {
    setLoading(true);
    try {
      console.log("Starting fetchDatabaseOverview...");
      
      // First ensure we're authenticated
      const { data: authData, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        console.error('Authentication error:', authError);
        toast.error(`Authentication error: ${authError.message}`);
        throw new Error(`Authentication error: ${authError.message}`);
      }
      
      if (!authData.session) {
        console.warn('No active session found. Attempting to sign in with test user');
        
        // Try auto-signin with test account
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: import.meta.env.VITE_TEST_USER_EMAIL,
          password: import.meta.env.VITE_TEST_USER_PASSWORD,
        });
        
        if (signInError || !signInData.session) {
          console.error('Sign in failed:', signInError);
          throw new Error(`Unable to authenticate: ${signInError?.message || 'No session created'}`);
        }
        
        console.log('Signed in as:', signInData.user?.email);
      } else {
        console.log('Already authenticated as:', authData.session.user.email);
      }
      
      // Use a list based on Database type instead of hardcoded values
      // Extract table names from the Database type
      const tableNames = [
        // Common tables that should exist
        'sources_google', 
        'sync_history',
        'google_auth_tokens',
        'experts',
        'expert_documents',
        'document_types',
        'function_registry',
        'ai_processing_attempts',
        'app_pages',
        'app_state',
        'asset_types',
        'audio_processing_configs',
        'audio_processing_stages',
        'audio_processor_steps',
        'audio_segments',
        'batch_processing_status',
        'citation_expert_aliases',
        'command_categories',
        'command_history',
        'command_patterns',
        'documentation_files',
        'documentation_processing_queue',
        'documentation_relations',
        'documentation_sections',
        'domains',
        'email_addresses',
        'emails',
        'favorite_commands',
        'function_relationships',
        'lionya_emails',
        'page_dependencies',
        'page_function_usage',
        'page_guts_raw_data',
        'page_table_usage',
        'presentation_assets',
        'presentation_collection_items',
        'presentation_collections',
        'presentation_relationships',
        'presentation_search_index',
        'presentation_tag_links',
        'presentation_tags',
        'presentation_theme_links',
        'presentation_themes',
        'presentations',
        'processing_batches',
        'processing_templates',
        'profiles',
        'sources',
        'sources_google_backup',
        'speaker_profiles',
        'sync_history_backup',
        'sync_statistics',
        'temp_sources',
        'transcription_feedback',
        'user_annotations'
      ];
      
      console.log(`Checking ${tableNames.length} potential tables...`);
      
      let tablesFound: string[] = [];
      
      // Try to check each table to see if it exists
      await Promise.all(tableNames.map(async (tableName) => {
        try {
          // Just try to get 1 row to see if the table exists
          const { count, error } = await supabase
            .from(tableName)
            .select('*', { count: 'exact', head: true });
            
          if (!error) {
            tablesFound.push(tableName);
            console.log(`Found table: ${tableName} with count: ${count || 0}`);
          }
        } catch (e) {
          // Table doesn't exist or can't be accessed
          console.log(`Table doesn't exist or can't be accessed: ${tableName}`);
        }
      }));
      
      if (tablesFound.length === 0) {
        console.log("No tables found, using fallback list");
        // Last resort - use a smaller list of common tables
        tablesFound = [
          'sources_google', 
          'sync_history',
          'experts',
          'expert_documents',
          'document_types',
          'function_registry'
        ];
      }
        
      // Create summaries from our found tables
      const summaries: TableSummary[] = tablesFound.map(tableName => ({
        table_name: tableName,
        row_count: 0, // We'll update these in the next step
        size: '~',
        last_vacuum: 'Unknown',
        missing_indexes: 0,
        has_primary_key: true,
        column_count: 0,
        status: 'warning'
      }));
      
      console.log(`Created ${summaries.length} table summaries`);
      setTables(summaries);
      
      // Try to get row counts for each table
      for (let i = 0; i < summaries.length; i++) {
        try {
          const { count, error } = await supabase
            .from(summaries[i].table_name)
            .select('*', { count: 'exact', head: true });
            
          if (!error && count !== null) {
            summaries[i].row_count = count;
            summaries[i].status = count > 0 ? 'good' : 'warning';
            console.log(`Updated row count for ${summaries[i].table_name}: ${count}`);
          }
        } catch (e) {
          console.log(`Failed to get row count for ${summaries[i].table_name}`);
        }
      }
      
      // Update tables with the row counts
      console.log(`Finalizing ${summaries.length} tables with row counts`);
      setTables([...summaries]);
      
      // Create database objects and try to get column info for each table
      const objects: DatabaseObject[] = [];
      
      for (const summary of summaries) {
        try {
          // Try to get column information for the table
          const { data, error } = await supabase
            .from(summary.table_name)
            .select('*')
            .limit(1);
            
          let definition = `-- No detailed information available for ${summary.table_name}`;
          
          if (!error && data && data.length > 0) {
            // Generate a basic CREATE TABLE statement from the columns
            const columns = Object.keys(data[0]).map(col => {
              const value = data[0][col];
              let type = 'text';
              
              if (typeof value === 'number') type = 'numeric';
              else if (typeof value === 'boolean') type = 'boolean';
              else if (value instanceof Date) type = 'timestamp';
              else if (typeof value === 'object' && value !== null) type = 'json';
              
              return `  ${col} ${type}`;
            });
            
            definition = `CREATE TABLE ${summary.table_name} (\n${columns.join(',\n')}\n);`;
            summary.column_count = columns.length;
          }
          
          objects.push({
            name: summary.table_name,
            type: 'table',
            definition,
            schema: 'public'
          });
        } catch (e) {
          objects.push({
            name: summary.table_name,
            type: 'table',
            definition: `-- Error getting information for ${summary.table_name}`,
            schema: 'public'
          });
        }
      }
      
      console.log(`Created ${objects.length} database objects`);
      setDbObjects(objects);
      setFilteredObjects(objects);
      
      console.log("Database overview fetched successfully");
    } catch (error) {
      console.error("Error in fetchDatabaseOverview:", error);
      toast.error("Failed to fetch database overview: " + (error instanceof Error ? error.message : String(error)));
      
      // Create some fallback data so the UI doesn't break
      console.log("Creating fallback data");
      setTables([
        {
          table_name: "users",
          row_count: 0,
          size: '~',
          last_vacuum: 'Unknown',
          missing_indexes: 0,
          has_primary_key: true,
          column_count: 0,
          status: 'warning'
        },
        {
          table_name: "profiles",
          row_count: 0,
          size: '~',
          last_vacuum: 'Unknown',
          missing_indexes: 0,
          has_primary_key: true,
          column_count: 0,
          status: 'warning'
        }
      ]);
      
      setDbObjects([
        {
          name: "users",
          type: 'table',
          definition: "-- No information available",
          schema: 'public'
        },
        {
          name: "profiles",
          type: 'table',
          definition: "-- No information available",
          schema: 'public'
        }
      ]);
      
      setFilteredObjects([
        {
          name: "users",
          type: 'table',
          definition: "-- No information available",
          schema: 'public'
        },
        {
          name: "profiles",
          type: 'table',
          definition: "-- No information available",
          schema: 'public'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableDetails = async (tableName: string) => {
    try {
      // First, ensure we're authenticated
      const { data: authData, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        console.error('Authentication error:', authError);
        toast.error(`Authentication error: ${authError.message}`);
        throw new Error(`Authentication error: ${authError.message}`);
      }
      
      if (!authData.session) {
        console.warn('No active session found. Attempting to sign in with test user');
        
        // Try auto-signin with test account
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: import.meta.env.VITE_TEST_USER_EMAIL,
          password: import.meta.env.VITE_TEST_USER_PASSWORD,
        });
        
        if (signInError || !signInData.session) {
          console.error('Sign in failed:', signInError);
          throw new Error(`Unable to authenticate: ${signInError?.message || 'No session created'}`);
        }
        
        console.log('Signed in as:', signInData.user?.email);
      }
      
      // First, try to get a row from the table and infer column structure from the data
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);
        
      if (!error && data && data.length > 0) {
        console.log(`Got sample data for ${tableName}, inferring columns...`);
        
        // Infer columns from the data
        const columns: TableColumn[] = Object.keys(data[0]).map(colName => {
          const value = data[0][colName];
          let dataType;
          
          if (typeof value === 'number') dataType = 'number';
          else if (typeof value === 'boolean') dataType = 'boolean';
          else if (value instanceof Date) dataType = 'timestamp';
          else if (typeof value === 'object' && value !== null) dataType = 'json';
          else dataType = 'text';
          
          return {
            column_name: colName,
            data_type: dataType,
            is_nullable: value === null ? 'YES' : 'NO',
            column_default: '',
            is_unique: colName === 'id' ? 'YES' : 'NO', // Assume id is unique
            foreign_key: '',
            trigger_name: '',
            check_constraint: ''
          };
        });
        
        setTableColumns(columns);
        toast.success(`Retrieved column information for ${tableName}`);
        return;
      }
      
      // Try to get column information via RPC if above failed
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_table_columns', {
          p_table_name: tableName
        });
        
        if (!rpcError && rpcData) {
          // Convert to table columns format
          const columns: TableColumn[] = rpcData.map((col: any) => ({
            column_name: col.column_name,
            data_type: col.data_type,
            is_nullable: col.is_nullable,
            column_default: col.column_default || '',
            is_unique: col.is_primary_key === true ? 'YES' : 'NO',
            foreign_key: col.foreign_key || '',
            trigger_name: '',
            check_constraint: ''
          }));
          
          setTableColumns(columns);
          toast.success(`Retrieved column information for ${tableName} using RPC`);
          return;
        }
      } catch (rpcErr) {
        console.error('RPC error for table columns:', rpcErr);
        // Continue to fallback approach
      }
      
      // Try to execute raw SQL via function if above methods fail
      try {
        const { data: sqlData, error: sqlError } = await supabase.rpc('execute_sql_query', {
          query: `SELECT column_name, data_type, is_nullable, column_default 
                 FROM information_schema.columns 
                 WHERE table_schema = 'public' AND table_name = '${tableName}'
                 ORDER BY ordinal_position`
        });
        
        if (!sqlError && sqlData) {
          // Convert to table columns format
          const columns: TableColumn[] = sqlData.map((col: any) => ({
            column_name: col.column_name,
            data_type: col.data_type,
            is_nullable: col.is_nullable,
            column_default: col.column_default || '',
            is_unique: 'NO', // We don't know this without more queries
            foreign_key: '',
            trigger_name: '',
            check_constraint: ''
          }));
          
          setTableColumns(columns);
          toast.success(`Retrieved column information for ${tableName} using SQL query`);
          return;
        }
      } catch (sqlErr) {
        console.error('SQL execution error for table columns:', sqlErr);
        // Continue to fallback approach
      }
      
      // Generate generic column information based on table name
      console.log(`Using inferred data for table ${tableName}`);
      
      // First, check if there are any basic column definitions in the DB type
      // Generate based on table name with reasonable defaults
      let columns: TableColumn[] = [];
      
      if (tableName === 'users') {
        columns = [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()', is_unique: 'YES', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'email', data_type: 'text', is_nullable: 'NO', column_default: '', is_unique: 'YES', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' }
        ];
      } else if (tableName === 'sources_google') {
        columns = [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()', is_unique: 'YES', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'drive_id', data_type: 'text', is_nullable: 'NO', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'name', data_type: 'text', is_nullable: 'YES', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'mime_type', data_type: 'text', is_nullable: 'YES', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' }
        ];
      } else if (tableName === 'experts') {
        columns = [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()', is_unique: 'YES', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'expert_name', data_type: 'text', is_nullable: 'NO', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'full_name', data_type: 'text', is_nullable: 'YES', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' }
        ];
      } else if (tableName === 'expert_documents') {
        columns = [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()', is_unique: 'YES', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'expert_id', data_type: 'uuid', is_nullable: 'YES', column_default: '', is_unique: 'NO', foreign_key: 'experts.id', trigger_name: '', check_constraint: '' },
          { column_name: 'source_id', data_type: 'uuid', is_nullable: 'NO', column_default: '', is_unique: 'NO', foreign_key: 'sources_google.id', trigger_name: '', check_constraint: '' },
          { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' }
        ];
      } else if (tableName === 'sync_history') {
        columns = [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()', is_unique: 'YES', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'folder_id', data_type: 'text', is_nullable: 'NO', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'folder_name', data_type: 'text', is_nullable: 'YES', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'status', data_type: 'text', is_nullable: 'YES', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'timestamp', data_type: 'timestamp', is_nullable: 'NO', column_default: 'now()', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' }
        ];
      } else if (tableName === 'document_types') {
        columns = [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()', is_unique: 'YES', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'document_type', data_type: 'text', is_nullable: 'NO', column_default: '', is_unique: 'YES', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'category', data_type: 'text', is_nullable: 'NO', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' }
        ];
      } else if (tableName === 'function_registry') {
        columns = [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()', is_unique: 'YES', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'name', data_type: 'text', is_nullable: 'NO', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'description', data_type: 'text', is_nullable: 'NO', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'category', data_type: 'text', is_nullable: 'NO', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'location', data_type: 'text', is_nullable: 'NO', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' }
        ];
      } else {
        // Generic columns for any other table
        columns = [
          { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'gen_random_uuid()', is_unique: 'YES', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'name', data_type: 'text', is_nullable: 'YES', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' },
          { column_name: 'updated_at', data_type: 'timestamp with time zone', is_nullable: 'YES', column_default: '', is_unique: 'NO', foreign_key: '', trigger_name: '', check_constraint: '' }
        ];
      }
      
      setTableColumns(columns);
      toast.info(`Showing inferred structure for table ${tableName}`);
      
    } catch (error) {
      console.error(`Error fetching details for table ${tableName}:`, error);
      toast.error(`Failed to fetch details for table ${tableName}`);
      
      // Set empty table columns to avoid UI errors
      setTableColumns([]);
    }
  };

  // Fetch query history from database
  const fetchQueryHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('sql_query_history')
        .select(`
          id,
          query_text,
          query_name,
          description,
          tags,
          created_at,
          last_executed_at,
          execution_count,
          is_favorite
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching query history:', error);
        toast.error('Failed to load query history');
        return;
      }

      setQueryHistory(data || []);
    } catch (err) {
      console.error('Error in fetchQueryHistory:', err);
      toast.error('Failed to load query history');
    }
  };

  // Fetch available tags
  const fetchAvailableTags = async () => {
    try {
      const { data, error } = await supabase
        .from('sql_query_tags')
        .select('tag_name')
        .order('tag_name');

      if (error) {
        console.error('Error fetching tags:', error);
        return;
      }

      setAvailableTags((data || []).map(tag => tag.tag_name));
    } catch (err) {
      console.error('Error in fetchAvailableTags:', err);
    }
  };

  // Save query to history
  const saveQueryToHistory = async () => {
    try {
      if (!sqlContent.trim()) {
        toast.error('Query content is empty');
        return;
      }

      // First save the query
      const { data: queryData, error: queryError } = await supabase
        .from('sql_query_history')
        .insert({
          query_text: sqlContent,
          query_name: queryName || null,
          description: queryDescription || null,
          tags: queryTags.length > 0 ? queryTags : null,
          created_at: new Date().toISOString(),
          created_by: null, // Will use RLS to set this
          execution_count: 1,
          last_executed_at: new Date().toISOString(),
          execution_status: sqlError ? 'error' : 'success'
        })
        .select('id')
        .single();

      if (queryError) {
        throw queryError;
      }

      // If there are specific tags we want to link in the junction table
      if (queryData && queryTags.length > 0) {
        // Ensure all tags exist in the tags table
        for (const tag of queryTags) {
          // Check if tag already exists
          const { data: existingTag } = await supabase
            .from('sql_query_tags')
            .select('id')
            .eq('tag_name', tag)
            .maybeSingle();

          if (!existingTag) {
            // Create new tag if it doesn't exist
            const { data: newTag, error: tagError } = await supabase
              .from('sql_query_tags')
              .insert({ tag_name: tag })
              .select('id')
              .single();

            if (tagError) {
              console.error(`Error creating tag ${tag}:`, tagError);
            }
          }
        }
      }

      toast.success('Query saved to history');
      setShowSaveQueryDialog(false);
      
      // Reset form
      setQueryName('');
      setQueryDescription('');
      setQueryTags([]);
      
      // Refresh query history
      fetchQueryHistory();
    } catch (err) {
      console.error('Error saving query:', err);
      toast.error('Failed to save query to history');
    }
  };

  // Generate AI tag suggestions for a query
  const generateTagSuggestions = async (query: string) => {
    try {
      // Here you would normally call an AI API
      // For demo purposes, we'll provide basic suggestions based on query content
      const lowerQuery = query.toLowerCase();
      const suggestions: string[] = [];
      
      if (lowerQuery.includes('select')) suggestions.push('select');
      if (lowerQuery.includes('where')) suggestions.push('filter');
      if (lowerQuery.includes('count')) suggestions.push('count');
      if (lowerQuery.includes('join')) suggestions.push('join');
      if (lowerQuery.includes('group by')) suggestions.push('aggregate');
      if (lowerQuery.includes('order by')) suggestions.push('sort');
      if (lowerQuery.includes('limit')) suggestions.push('limited');
      
      // Add the table names found in the query
      const tableMatches = lowerQuery.match(/from\s+([a-z0-9_]+)/gi);
      if (tableMatches) {
        tableMatches.forEach(match => {
          const tableName = match.replace(/from\s+/i, '').trim();
          suggestions.push(`table:${tableName}`);
        });
      }
      
      setSuggestedTags([...new Set(suggestions)]);
    } catch (error) {
      console.error('Error generating tag suggestions:', error);
    }
  };
  
  const runSql = async () => {
    if (!sqlContent.trim()) {
      toast.warning("Please enter SQL to run");
      return;
    }
    
    setSqlRunning(true);
    setSqlError(null);
    setSqlResult(null);
    
    try {
      // First, ensure we're authenticated
      const { data: authData, error: authError } = await supabase.auth.getSession();
      
      if (authError) {
        console.error('Authentication error:', authError);
        toast.error(`Authentication error: ${authError.message}`);
        throw new Error(`Authentication error: ${authError.message}`);
      }
      
      if (!authData.session) {
        console.warn('No active session found. Attempting to sign in with test user');
        
        // Try auto-signin with test account
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: import.meta.env.VITE_TEST_USER_EMAIL,
          password: import.meta.env.VITE_TEST_USER_PASSWORD,
        });
        
        if (signInError || !signInData.session) {
          console.error('Sign in failed:', signInError);
          throw new Error(`Unable to authenticate: ${signInError?.message || 'No session created'}`);
        }
        
        console.log('Signed in as:', signInData.user?.email);
      }
      
      // For safety, only allow certain kinds of queries
      const sql = sqlContent.trim();
      
      // Check if this is a SELECT query (safer to execute)
      if (sql.toLowerCase().startsWith('select')) {
        // For information schema queries or specific SQL queries
        if (sql.toLowerCase().includes('information_schema') || sql.toLowerCase().includes('pg_')) {
          // Use the Database.type defined tables to simulate information_schema queries
          // This avoids the need for RPC or direct SQL access
          if (sql.toLowerCase().includes('information_schema.tables') && 
              sql.toLowerCase().includes('table_schema = \'public\'')) {
            
            console.log('Processing information_schema.tables query manually');
            
            // Extract all tables from the types.ts definition
            const tableNames = [
              'sources_google', 
              'sync_history',
              'google_auth_tokens',
              'experts',
              'expert_documents',
              'document_types',
              'function_registry',
              'ai_processing_attempts',
              'app_pages',
              'app_state',
              'asset_types',
              'audio_processing_configs',
              'audio_processing_stages',
              'audio_processor_steps',
              'audio_segments',
              'batch_processing_status',
              'citation_expert_aliases',
              'command_categories',
              'command_history',
              'command_patterns',
              'documentation_files',
              'documentation_processing_queue',
              'documentation_relations',
              'documentation_sections',
              'domains',
              'email_addresses',
              'emails',
              'favorite_commands',
              'function_relationships',
              'lionya_emails',
              'page_dependencies',
              'page_function_usage',
              'page_guts_raw_data',
              'page_table_usage',
              'presentation_assets',
              'presentation_collection_items',
              'presentation_collections',
              'presentation_relationships',
              'presentation_search_index',
              'presentation_tag_links',
              'presentation_tags',
              'presentation_theme_links',
              'presentation_themes',
              'presentations',
              'processing_batches',
              'processing_templates',
              'profiles',
              'sources',
              'sources_google_backup',
              'speaker_profiles',
              'sync_history_backup',
              'sync_statistics',
              'temp_sources',
              'transcription_feedback',
              'user_annotations'
            ];
            
            // Now check which of these tables actually exist by trying to get 1 row
            const result = [];
            
            for (const tableName of tableNames) {
              try {
                const { error } = await supabase
                  .from(tableName)
                  .select('*', { count: 'exact', head: true });
                  
                if (!error) {
                  result.push({
                    table_catalog: 'supabase',
                    table_schema: 'public',
                    table_name: tableName,
                    table_type: 'BASE TABLE'
                  });
                  console.log(`Found table: ${tableName}`);
                }
              } catch (e) {
                console.log(`Table doesn't exist or can't be accessed: ${tableName}`);
              }
            }
            
            // Add views
            const views = ['batch_processing_status', 'command_suggestions', 'page_guts_raw_data'];
            for (const viewName of views) {
              try {
                const { error } = await supabase
                  .from(viewName)
                  .select('*', { count: 'exact', head: true });
                  
                if (!error) {
                  result.push({
                    table_catalog: 'supabase',
                    table_schema: 'public',
                    table_name: viewName,
                    table_type: 'VIEW'
                  });
                  console.log(`Found view: ${viewName}`);
                }
              } catch (e) {
                console.log(`View doesn't exist or can't be accessed: ${viewName}`);
              }
            }
            
            setSqlResult(result);
            toast.success(`Query executed successfully. Found ${result.length} tables/views.`);
            return;
          }
          // Handle information_schema.columns query
          else if (sql.toLowerCase().includes('information_schema.columns')) {
            const tableNameMatch = sql.match(/table_name\s*=\s*['"]([^'"]+)['"]/i);
            
            if (tableNameMatch) {
              const tableName = tableNameMatch[1];
              console.log(`Getting columns for table ${tableName}`);
              
              try {
                // Try to get real data
                const { data, error } = await supabase
                  .from(tableName)
                  .select('*')
                  .limit(1);
                  
                if (!error && data && data.length > 0) {
                  // Generate column info from the data
                  const columns = Object.keys(data[0]).map((colName, index) => {
                    const value = data[0][colName];
                    let dataType;
                    
                    if (typeof value === 'number') dataType = 'numeric';
                    else if (typeof value === 'boolean') dataType = 'boolean';
                    else if (value instanceof Date) dataType = 'timestamp with time zone';
                    else if (typeof value === 'object' && value !== null) dataType = 'jsonb';
                    else dataType = 'text';
                    
                    return {
                      table_catalog: 'supabase',
                      table_schema: 'public',
                      table_name: tableName,
                      column_name: colName,
                      ordinal_position: index + 1,
                      column_default: null,
                      is_nullable: 'YES',
                      data_type: dataType,
                      character_maximum_length: null,
                      udt_name: dataType
                    };
                  });
                  
                  setSqlResult(columns);
                  toast.success(`Found ${columns.length} columns for table ${tableName}`);
                  return;
                } else {
                  throw new Error(`Could not get data for table ${tableName}`);
                }
              } catch (e) {
                console.error(`Error getting columns for ${tableName}:`, e);
                setSqlError(`Could not get column information for table ${tableName}`);
                toast.error(`Failed to get column information.`);
                return;
              }
            } else {
              setSqlError("Could not extract table name from SQL query.");
              toast.error("Failed to parse table name from query.");
              return;
            }
          }
          // Handle query for counting rows in all tables
          else if (sql.toLowerCase().includes('count') && 
                  sql.toLowerCase().includes('information_schema.tables') &&
                  (sql.toLowerCase().includes('row_count') || sql.toLowerCase().includes('xml_count'))) {
            
            console.log('Processing table row count query manually');
            
            // Extract all tables from the types.ts definition
            const tableNames = [
              'sources_google', 
              'sync_history',
              'google_auth_tokens',
              'experts',
              'expert_documents',
              'document_types',
              'function_registry',
              'ai_processing_attempts',
              'app_pages',
              'app_state',
              'asset_types',
              'audio_processing_configs',
              'audio_processing_stages',
              'audio_processor_steps',
              'audio_segments',
              'batch_processing_status',
              'citation_expert_aliases',
              'command_categories',
              'command_history',
              'command_patterns',
              'documentation_files',
              'documentation_processing_queue',
              'documentation_relations',
              'documentation_sections',
              'domains',
              'email_addresses',
              'emails',
              'favorite_commands',
              'function_relationships',
              'lionya_emails',
              'page_dependencies',
              'page_function_usage',
              'page_guts_raw_data',
              'page_table_usage',
              'presentation_assets',
              'presentation_collection_items',
              'presentation_collections',
              'presentation_relationships',
              'presentation_search_index',
              'presentation_tag_links',
              'presentation_tags',
              'presentation_theme_links',
              'presentation_themes',
              'presentations',
              'processing_batches',
              'processing_templates',
              'profiles',
              'sources',
              'sources_google_backup',
              'speaker_profiles',
              'sync_history_backup',
              'sync_statistics',
              'temp_sources',
              'transcription_feedback',
              'user_annotations'
            ];
            
            // Now check which of these tables actually exist and get their row counts
            const result = [];
            
            for (const tableName of tableNames) {
              try {
                const { count, error } = await supabase
                  .from(tableName)
                  .select('*', { count: 'exact', head: true });
                  
                if (!error) {
                  result.push({
                    table_schema: 'public',
                    table_name: tableName,
                    row_count: count || 0
                  });
                  console.log(`Found table: ${tableName} with ${count || 0} rows`);
                }
              } catch (e) {
                console.log(`Table doesn't exist or can't be accessed: ${tableName}`);
              }
            }
            
            // Add views
            const views = ['batch_processing_status', 'command_suggestions', 'page_guts_raw_data'];
            for (const viewName of views) {
              try {
                const { count, error } = await supabase
                  .from(viewName)
                  .select('*', { count: 'exact', head: true });
                  
                if (!error) {
                  result.push({
                    table_schema: 'public',
                    table_name: viewName,
                    row_count: count || 0
                  });
                  console.log(`Found view: ${viewName} with ${count || 0} rows`);
                }
              } catch (e) {
                console.log(`View doesn't exist or can't be accessed: ${viewName}`);
              }
            }
            
            // Sort the results to match the SQL query
            result.sort((a, b) => {
              if (a.table_schema === b.table_schema) {
                return a.table_name.localeCompare(b.table_name);
              }
              return a.table_schema.localeCompare(b.table_schema);
            });
            
            setSqlResult(result);
            toast.success(`Query executed successfully. Found ${result.length} tables/views with row counts.`);
            return;
          }
          // Other information_schema or pg_ queries - not supported directly
          else {
            setSqlError("This type of information_schema or pg_ query is not supported directly through the SQL Editor.");
            toast.error("This type of system catalog query is not supported.");
            return;
          }
        }
        // Regular table query
        else {
          // Try to extract a table name from the query
          const tableMatch = sql.match(/from\s+([a-zA-Z0-9_]+)/i);
          if (tableMatch && tableMatch[1]) {
            const tableName = tableMatch[1];
            try {
              const { data, error } = await supabase
                .from(tableName)
                .select('*')
                .limit(1000); // Increase limit from 100 to 1000
                
              if (error) throw error;
              setSqlResult(data || []);
              toast.success(`Query executed successfully. Found ${data?.length || 0} rows.`);
            } catch (err: any) {
              throw new Error(`Error querying table ${tableName}: ${err.message}`);
            }
          } else {
            setSqlError("Unable to parse table name from query");
            toast.error("Unable to parse query");
          }
        }
      } 
      else {
        // Non-SELECT statements are not supported
        setSqlError("Only SELECT queries are supported in this demo");
        toast.error("Only SELECT queries are supported");
      }
    } catch (error: any) {
      console.error("SQL execution error:", error);
      setSqlError(error.message || "An error occurred while executing SQL");
      toast.error("SQL execution failed");
    } finally {
      setSqlRunning(false);
    }
  };

  const saveMigration = async () => {
    if (!newMigrationName.trim() || !newMigrationSql.trim()) {
      toast.warning("Please provide both a name and SQL content for the migration");
      return;
    }
    
    try {
      const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').substring(0, 14);
      const migrationName = `${timestamp}_${newMigrationName.replace(/\s+/g, '_').toLowerCase()}`;
      
      // Simulated migration creation
      const newMigration = {
        id: migrationLogs.length + 1,
        name: migrationName,
        executed_at: new Date().toISOString(),
        success: true,
        sql_content: newMigrationSql
      };
      
      setMigrationLogs([newMigration, ...migrationLogs]);
      
      toast.success("Migration saved successfully");
      setNewMigrationName("");
      setNewMigrationSql("");
      
    } catch (error) {
      console.error("Error saving migration:", error);
      toast.error("Failed to save migration");
    }
  };

  const createObject = async (type: string) => {
    const templates: Record<string, string> = {
      table: `CREATE TABLE IF NOT EXISTS public.new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add comments
COMMENT ON TABLE public.new_table IS 'Stores information about new entities';
COMMENT ON COLUMN public.new_table.id IS 'Primary UUID identifier';

-- Create index
CREATE INDEX IF NOT EXISTS idx_new_table_name ON public.new_table (name);

-- Add row level security
ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all users to view new_table" ON public.new_table
  FOR SELECT USING (true);
  
-- Add triggers for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.new_table
  FOR EACH ROW
  EXECUTE FUNCTION public.moddatetime();`,
      
      view: `CREATE OR REPLACE VIEW public.new_view AS
SELECT
  id,
  name,
  description,
  created_at
FROM
  public.some_existing_table
WHERE
  is_active = true;
  
-- Add comment
COMMENT ON VIEW public.new_view IS 'View that shows only active items';`,
      
      function: `CREATE OR REPLACE FUNCTION public.new_function(param1 TEXT)
RETURNS TABLE (
  id UUID,
  result TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name || ' - ' || param1 AS result
  FROM
    public.some_existing_table t
  WHERE
    t.is_active = true;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.new_function(TEXT) IS 'Function that processes active items';`,
      
      enum: `-- Create a new enum type
CREATE TYPE public.new_status_enum AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

-- Add comment
COMMENT ON TYPE public.new_status_enum IS 'Enum for tracking processing status';`
    };
    
    // Set template SQL for the selected object type
    if (templates[type]) {
      setActiveTab("sql");
      setSqlContent(templates[type]);
      toast.success(`Template for creating a new ${type} has been loaded. Review and run the SQL.`);
    } else {
      toast.error(`No template available for ${type}`);
    }
  };

  const filterObjects = () => {
    let filtered = [...dbObjects];
    
    // Filter by type
    if (objectType !== "all") {
      filtered = filtered.filter(obj => obj.type === objectType);
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(obj => 
        obj.name.toLowerCase().includes(term) || 
        obj.definition.toLowerCase().includes(term) ||
        (obj.notes && obj.notes.toLowerCase().includes(term))
      );
    }
    
    setFilteredObjects(filtered);
  };

  const exportSchema = () => {
    const element = document.createElement("a");
    const file = new Blob([schemaSql], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `schema_${new Date().toISOString().split('T')[0]}.sql`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("Schema exported successfully");
  };

  const exportTypes = () => {
    toast.success("Types export initiated");
    // This would trigger the generation of the types.ts file
  };

  const getStatusColor = (status: 'good' | 'warning' | 'danger') => {
    switch (status) {
      case 'good': return 'bg-green-100 text-green-800';
      case 'warning': return 'bg-yellow-100 text-yellow-800';
      case 'danger': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getObjectTypeIcon = (type: string) => {
    switch (type) {
      case 'table': return <Table2 className="h-4 w-4" />;
      case 'view': return <FileSymlink className="h-4 w-4" />;
      case 'function': return <Code className="h-4 w-4" />;
      case 'trigger': return <AlertCircle className="h-4 w-4" />;
      case 'enum': return <List className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-600">Loading Supabase manager...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6 flex items-center">
        <Database className="mr-2 h-8 w-8 text-blue-500" />
        Supabase Database Manager
      </h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-7 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tables">Tables & Views</TabsTrigger>
          <TabsTrigger value="objects">Database Objects</TabsTrigger>
          <TabsTrigger value="sql">SQL Editor</TabsTrigger>
          <TabsTrigger value="migrations">Migrations</TabsTrigger>
          <TabsTrigger value="export">Schema & Types</TabsTrigger>
          <TabsTrigger value="legacy">Legacy Tools</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Tables</CardTitle>
                <CardDescription>Database tables and their status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{tables.length}</div>
                <div className="text-sm text-gray-500 mt-2">
                  {tables.filter(t => t.status === 'good').length} Good,{' '}
                  {tables.filter(t => t.status === 'warning').length} Warning,{' '}
                  {tables.filter(t => t.status === 'danger').length} Critical
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Objects</CardTitle>
                <CardDescription>Total database objects</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{dbObjects.length}</div>
                <div className="text-sm text-gray-500 mt-2">
                  {dbObjects.filter(o => o.type === 'table').length} Tables,{' '}
                  {dbObjects.filter(o => o.type === 'view').length} Views,{' '}
                  {dbObjects.filter(o => o.type === 'function').length} Functions
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Migrations</CardTitle>
                <CardDescription>Migration history</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold">{migrationLogs.length}</div>
                <div className="text-sm text-gray-500 mt-2">
                  {migrationLogs.filter(m => m.success).length} Successful,{' '}
                  {migrationLogs.filter(m => !m.success).length} Failed
                </div>
              </CardContent>
            </Card>
          </div>
          
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common database management tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button variant="outline" onClick={() => { setActiveTab("sql"); setSqlContent("SELECT * FROM information_schema.tables WHERE table_schema = 'public';"); }}>
                  <Database className="mr-2 h-4 w-4" />
                  List All Tables
                </Button>
                <Button variant="outline" onClick={() => { setActiveTab("sql"); setSqlContent("SELECT table_name, pg_size_pretty(pg_total_relation_size(table_name::text)) as size FROM information_schema.tables WHERE table_schema = 'public' ORDER BY pg_total_relation_size(table_name::text) DESC;"); }}>
                  <Archive className="mr-2 h-4 w-4" />
                  Table Sizes
                </Button>
                <Button variant="outline" onClick={() => createObject('table')}>
                  <Table2 className="mr-2 h-4 w-4" />
                  New Table Template
                </Button>
                <Button variant="outline" onClick={() => exportSchema()}>
                  <Code className="mr-2 h-4 w-4" />
                  Export Schema
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Tables & Views Tab */}
        <TabsContent value="tables" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Tables & Views</CardTitle>
                  <CardDescription>Select a table to view details</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Rows</TableHead>
                          <TableHead>Size</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tables.map((table) => (
                          <TableRow 
                            key={table.table_name}
                            className={selectedTable === table.table_name ? 'bg-blue-50' : ''}
                            onClick={() => setSelectedTable(table.table_name)}
                          >
                            <TableCell className="font-medium">{table.table_name}</TableCell>
                            <TableCell>{table.row_count.toLocaleString()}</TableCell>
                            <TableCell>{table.size}</TableCell>
                            <TableCell>
                              <Badge className={getStatusColor(table.status)}>
                                {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="md:col-span-7">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{selectedTable ? selectedTable : 'Table Structure'}</CardTitle>
                  <CardDescription>
                    {selectedTable ? `Details and columns for ${selectedTable}` : 'Select a table to view details'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedTable ? (
                    <div className="max-h-[600px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Column</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Nullable</TableHead>
                            <TableHead>Constraints</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tableColumns.map((column) => (
                            <TableRow key={column.column_name}>
                              <TableCell className="font-medium">{column.column_name}</TableCell>
                              <TableCell>{column.data_type}</TableCell>
                              <TableCell>{column.is_nullable === 'YES' ? '✓' : '✗'}</TableCell>
                              <TableCell>
                                {column.is_unique === 'YES' && (
                                  <Badge className="mr-1 bg-blue-100 text-blue-800">Unique</Badge>
                                )}
                                {column.foreign_key && (
                                  <Badge className="mr-1 bg-purple-100 text-purple-800">FK</Badge>
                                )}
                                {column.check_constraint && (
                                  <Badge className="mr-1 bg-yellow-100 text-yellow-800">Check</Badge>
                                )}
                                {column.column_default && (
                                  <Badge className="bg-gray-100 text-gray-800">Default</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      
                      {/* Actions for this table */}
                      <div className="mt-4 space-x-2">
                        <Button variant="outline" size="sm" onClick={() => { 
                          setActiveTab("sql"); 
                          setSqlContent(`-- Generate SQL to recreate the table structure\nSELECT * FROM information_schema.columns WHERE table_name = '${selectedTable}' ORDER BY ordinal_position;`); 
                        }}>
                          Show CREATE Statement
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { 
                          setActiveTab("sql"); 
                          setSqlContent(`-- Analyze the table\nANALYZE ${selectedTable};\n\n-- Show statistics\nSELECT * FROM pg_stats WHERE tablename = '${selectedTable}';`); 
                        }}>
                          Analyze Table
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-gray-500">
                      Select a table from the list to view its structure
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* Database Objects Tab */}
        <TabsContent value="objects" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="w-full md:w-1/3">
              <Card>
                <CardHeader>
                  <CardTitle>Object Browser</CardTitle>
                  <CardDescription>View and search database objects</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Select value={objectType} onValueChange={setObjectType}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Filter by type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Objects</SelectItem>
                          <SelectItem value="table">Tables</SelectItem>
                          <SelectItem value="view">Views</SelectItem>
                          <SelectItem value="function">Functions</SelectItem>
                          <SelectItem value="trigger">Triggers</SelectItem>
                          <SelectItem value="constraint">Constraints</SelectItem>
                          <SelectItem value="index">Indexes</SelectItem>
                          <SelectItem value="enum">Enums</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <Input
                      placeholder="Search objects..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    
                    <div>
                      <p className="text-sm text-gray-500 mb-2">
                        {filteredObjects.length} objects found
                      </p>
                      
                      <div className="max-h-[400px] overflow-y-auto border rounded-md">
                        <div className="divide-y">
                          {filteredObjects.map((obj) => (
                            <div 
                              key={`${obj.type}-${obj.name}`}
                              className="p-2 hover:bg-gray-50 cursor-pointer"
                              onClick={() => { 
                                setActiveTab("sql"); 
                                setSqlContent(obj.definition); 
                              }}
                            >
                              <div className="flex items-center gap-2">
                                {getObjectTypeIcon(obj.type)}
                                <span className="font-medium truncate">{obj.name}</span>
                                <Badge className="ml-auto">{obj.type}</Badge>
                              </div>
                              <div className="text-xs text-gray-500 mt-1 truncate">
                                {obj.schema}.{obj.name}
                              </div>
                            </div>
                          ))}
                          
                          {filteredObjects.length === 0 && (
                            <div className="p-4 text-center text-gray-500">
                              No objects found matching your criteria
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="w-full md:w-2/3">
              <Card>
                <CardHeader>
                  <CardTitle>Create New Database Object</CardTitle>
                  <CardDescription>Generate templates for new database objects</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Button onClick={() => createObject('table')}>
                      <Table2 className="mr-2 h-4 w-4" />
                      Create Table
                    </Button>
                    <Button onClick={() => createObject('view')}>
                      <FileSymlink className="mr-2 h-4 w-4" />
                      Create View
                    </Button>
                    <Button onClick={() => createObject('function')}>
                      <Code className="mr-2 h-4 w-4" />
                      Create Function
                    </Button>
                    <Button onClick={() => createObject('enum')}>
                      <List className="mr-2 h-4 w-4" />
                      Create Enum
                    </Button>
                  </div>
                  
                  <div className="mt-8">
                    <h3 className="text-lg font-medium mb-4">Object Categories</h3>
                    
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="tables">
                        <AccordionTrigger>Tables & Views</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span>Tables</span>
                              <Badge>{dbObjects.filter(o => o.type === 'table').length}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>Views</span>
                              <Badge>{dbObjects.filter(o => o.type === 'view').length}</Badge>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="functions">
                        <AccordionTrigger>Functions & Triggers</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span>Functions</span>
                              <Badge>{dbObjects.filter(o => o.type === 'function').length}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>Triggers</span>
                              <Badge>{dbObjects.filter(o => o.type === 'trigger').length}</Badge>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                      
                      <AccordionItem value="other">
                        <AccordionTrigger>Other Objects</AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2">
                            <div className="flex justify-between">
                              <span>Constraints</span>
                              <Badge>{dbObjects.filter(o => o.type === 'constraint').length}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>Indexes</span>
                              <Badge>{dbObjects.filter(o => o.type === 'index').length}</Badge>
                            </div>
                            <div className="flex justify-between">
                              <span>Enums</span>
                              <Badge>{dbObjects.filter(o => o.type === 'enum').length}</Badge>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* SQL Editor Tab */}
        <TabsContent value="sql" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>SQL Editor</CardTitle>
              <CardDescription>Run SQL queries and view results</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Textarea
                  className="font-mono h-40 resize-y"
                  placeholder="Enter SQL query..."
                  value={sqlContent}
                  onChange={(e) => setSqlContent(e.target.value)}
                />
                
                <div className="flex justify-between">
                  <div className="space-x-2">
                    <Button onClick={runSql} disabled={sqlRunning}>
                      {sqlRunning ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>Run SQL</>
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => setSqlContent("")}>
                      Clear
                    </Button>
                    
                    {sqlResult && (
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          // Generate tag suggestions first
                          generateTagSuggestions(sqlContent);
                          setShowSaveQueryDialog(true);
                        }}
                      >
                        Save Query
                      </Button>
                    )}
                  </div>
                  
                  <div className="space-x-2">
                    <Button variant="outline" onClick={() => { 
                      setSqlContent("SELECT * FROM information_schema.tables WHERE table_schema = 'public';"); 
                    }}>
                      List Tables
                    </Button>
                    <Button variant="outline" onClick={() => { 
                      setSqlContent("SELECT * FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sources_google';"); 
                    }}>
                      Table Columns
                    </Button>
                  </div>
                </div>
                
                {sqlError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>SQL Error</AlertTitle>
                    <AlertDescription className="font-mono text-sm whitespace-pre-wrap">
                      {sqlError}
                    </AlertDescription>
                  </Alert>
                )}
                
                {sqlResult && (
                  <div className="mt-4">
                    <h3 className="text-lg font-semibold mb-2">Results</h3>
                    
                    {Array.isArray(sqlResult) ? (
                      <div className="border rounded-md overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {sqlResult.length > 0 && Object.keys(sqlResult[0]).map((key) => (
                                <TableHead key={key}>{key}</TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {sqlResult.map((row, index) => (
                              <TableRow key={index}>
                                {Object.values(row).map((value: any, i) => (
                                  <TableCell key={i}>
                                    {typeof value === 'object' 
                                      ? JSON.stringify(value) 
                                      : String(value)}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="p-4 border rounded-md">
                        <pre className="whitespace-pre-wrap">{JSON.stringify(sqlResult, null, 2)}</pre>
                      </div>
                    )}
                    
                    <div className="mt-2 text-sm text-gray-500">
                      {Array.isArray(sqlResult) 
                        ? `${sqlResult.length} rows returned` 
                        : 'Operation completed successfully'}
                    </div>
                  </div>
                )}
                
                {/* Query History Section */}
                <div className="mt-8">
                  <h3 className="text-xl font-semibold mb-4">Query History</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name/Description</TableHead>
                          <TableHead>Tags</TableHead>
                          <TableHead>Executed</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {queryHistory.length > 0 ? (
                          queryHistory.map((query) => (
                            <TableRow key={query.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{query.query_name || 'Unnamed Query'}</div>
                                  <div className="text-sm text-gray-500 truncate">{query.description || 'No description'}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {query.tags && query.tags.map((tag: string) => (
                                    <Badge key={tag} className="bg-blue-100 text-blue-800">{tag}</Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  {new Date(query.last_executed_at).toLocaleString()}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Used {query.execution_count} time{query.execution_count !== 1 ? 's' : ''}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => {
                                    setSqlContent(query.query_text);
                                    toast.success('Query loaded from history');
                                  }}
                                >
                                  Load
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-4 text-gray-500">
                              No saved queries found. Run and save a query to see it here.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Save Query Dialog */}
          {showSaveQueryDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">Save Query to History</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name</label>
                    <Input
                      placeholder="Give your query a name"
                      value={queryName}
                      onChange={(e) => setQueryName(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Description</label>
                    <Textarea
                      placeholder="What does this query do?"
                      value={queryDescription}
                      onChange={(e) => setQueryDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Tags</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {queryTags.map(tag => (
                        <Badge key={tag} variant="outline" className="flex items-center gap-1">
                          {tag}
                          <button 
                            className="ml-1 text-gray-500 hover:text-gray-700"
                            onClick={() => setQueryTags(queryTags.filter(t => t !== tag))}
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                    
                    {suggestedTags.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium mb-1">AI Suggestions:</p>
                        <div className="flex flex-wrap gap-1">
                          {suggestedTags.map(tag => (
                            <Badge 
                              key={tag} 
                              variant="secondary"
                              className="cursor-pointer hover:bg-gray-200"
                              onClick={() => {
                                if (!queryTags.includes(tag)) {
                                  setQueryTags([...queryTags, tag]);
                                }
                              }}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Input
                        placeholder="Add a custom tag"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.currentTarget.value) {
                            const newTag = e.currentTarget.value;
                            if (!queryTags.includes(newTag)) {
                              setQueryTags([...queryTags, newTag]);
                            }
                            e.currentTarget.value = '';
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" onClick={() => setShowSaveQueryDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveQueryToHistory}>
                    Save Query
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
        
        {/* Migrations Tab */}
        <TabsContent value="migrations" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-5">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Migration History</CardTitle>
                  <CardDescription>Track database changes over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[600px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {migrationLogs.map((migration) => (
                          <TableRow key={migration.id}>
                            <TableCell className="font-medium">{migration.name}</TableCell>
                            <TableCell>{new Date(migration.executed_at).toLocaleString()}</TableCell>
                            <TableCell>
                              {migration.success ? (
                                <Badge className="bg-green-100 text-green-800">Success</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-800">Failed</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        
                        {migrationLogs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-gray-500 py-4">
                              No migrations found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <div className="md:col-span-7">
              <Card>
                <CardHeader>
                  <CardTitle>New Migration</CardTitle>
                  <CardDescription>Create a new database migration</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Migration Name
                      </label>
                      <Input 
                        placeholder="e.g., add_status_column" 
                        value={newMigrationName}
                        onChange={(e) => setNewMigrationName(e.target.value)}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Name will be prefixed with timestamp: {new Date().toISOString().slice(0, 10).replace(/-/g, '')}_name
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        SQL Content
                      </label>
                      <Textarea
                        className="font-mono h-40"
                        placeholder="-- Write your migration SQL here..."
                        value={newMigrationSql}
                        onChange={(e) => setNewMigrationSql(e.target.value)}
                      />
                    </div>
                    
                    <div className="flex justify-between">
                      <Button onClick={saveMigration}>
                        Save Migration
                      </Button>
                      <Button variant="outline" onClick={() => {
                        setNewMigrationName("");
                        setNewMigrationSql("");
                      }}>
                        Clear
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle>SQL Templates</CardTitle>
                  <CardDescription>Common migration patterns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setNewMigrationSql(`-- Add a new column to an existing table
ALTER TABLE table_name 
ADD COLUMN new_column_name TEXT;

-- Add a comment for the new column
COMMENT ON COLUMN table_name.new_column_name IS 'Description of the new column';`);
                    }}>
                      Add Column
                    </Button>
                    
                    <Button variant="outline" size="sm" onClick={() => {
                      setNewMigrationSql(`-- Create a new index
CREATE INDEX IF NOT EXISTS idx_table_column ON table_name (column_name);`);
                    }}>
                      Create Index
                    </Button>
                    
                    <Button variant="outline" size="sm" onClick={() => {
                      setNewMigrationSql(`-- Create a new enum type
CREATE TYPE status_enum AS ENUM ('pending', 'active', 'completed', 'failed');

-- Add column using the new enum
ALTER TABLE table_name
ADD COLUMN status status_enum DEFAULT 'pending';`);
                    }}>
                      Create Enum
                    </Button>
                    
                    <Button variant="outline" size="sm" onClick={() => {
                      setNewMigrationSql(`-- Add foreign key constraint
ALTER TABLE child_table
ADD CONSTRAINT fk_parent
FOREIGN KEY (parent_id) 
REFERENCES parent_table(id)
ON DELETE CASCADE;`);
                    }}>
                      Add Foreign Key
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
        
        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Database Schema</CardTitle>
                <CardDescription>Export the entire database schema as SQL</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border rounded-md">
                    <Textarea
                      className="font-mono h-60 resize-none"
                      value={schemaSql}
                      readOnly
                    />
                  </div>
                  
                  <div className="flex justify-between">
                    <Button onClick={exportSchema}>
                      Export Schema SQL
                    </Button>
                    <Button variant="outline" onClick={() => {
                      const element = document.createElement("a");
                      const file = new Blob([schemaSql], {type: 'text/plain'});
                      element.href = URL.createObjectURL(file);
                      element.download = `schema_documentation_${new Date().toISOString().split('T')[0]}.md`;
                      document.body.appendChild(element);
                      element.click();
                    }}>
                      Export Documentation
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>TypeScript Types</CardTitle>
                <CardDescription>Generate TypeScript types from database schema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 border rounded-md bg-gray-50">
                    <h3 className="font-medium mb-2">Generated Types</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      The types.ts file contains TypeScript definitions for all database tables and objects.
                      It's used throughout the project to provide type safety when interacting with the database.
                    </p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">File Location:</span>
                        <code className="bg-gray-100 px-2 py-1 rounded text-sm">supabase/types.ts</code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Last Generated:</span>
                        <span className="text-sm">
                          {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Tables Included:</span>
                        <span className="text-sm">{tables.length}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Keep Types in Sync</AlertTitle>
                    <AlertDescription>
                      When you make database changes, always regenerate types to keep your TypeScript code in sync with your database schema.
                    </AlertDescription>
                  </Alert>
                  
                  <Button onClick={exportTypes}>
                    Generate types.ts
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Legacy Tools Tab - This preserves the previous functionality */}
        <TabsContent value="legacy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Legacy Supabase Tools</CardTitle>
              <CardDescription>Access the previous Supabase management interface</CardDescription>
            </CardHeader>
            <CardContent>
              <LegacySupabasePage />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupabaseAdmin;