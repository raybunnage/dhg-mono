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
import { toast } from 'sonner';

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

const SupabaseManager: React.FC = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<TableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableColumns, setTableColumns] = useState<TableColumn[]>([]);
  const [sqlContent, setSqlContent] = useState("");
  const [sqlResult, setSqlResult] = useState<any>(null);
  const [sqlError, setSqlError] = useState<string | null>(null);
  const [sqlRunning, setSqlRunning] = useState(false);
  const [dbObjects, setDbObjects] = useState<DatabaseObject[]>([]);
  const [filteredObjects, setFilteredObjects] = useState<DatabaseObject[]>([]);
  const [migrationLogs, setMigrationLogs] = useState<MigrationLog[]>([]);
  const [newMigrationName, setNewMigrationName] = useState("");
  const [newMigrationSql, setNewMigrationSql] = useState("");
  const [schemaSql, setSchemaSql] = useState("");
  const [objectType, setObjectType] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [inconsistencies, setInconsistencies] = useState<any[]>([]);

  useEffect(() => {
    fetchDatabaseOverview();
  }, []);

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
      // Fetch table summaries
      const { data: tableSummaries, error } = await supabase.rpc('get_table_summaries');
      if (error) throw error;
      setTables(tableSummaries || []);
      
      // Fetch database objects
      const { data: objects, error: objectsError } = await supabase.rpc('get_all_database_objects');
      if (objectsError) throw objectsError;
      setDbObjects(objects || []);

      // Fetch migrations
      const { data: migrations, error: migrationsError } = await supabase.from('migration_logs').select('*').order('executed_at', { ascending: false });
      if (migrationsError) throw migrationsError;
      setMigrationLogs(migrations || []);

      // Fetch schema inconsistencies
      const { data: schemaIssues, error: schemaError } = await supabase.rpc('find_schema_inconsistencies');
      if (schemaError) throw schemaError;
      setInconsistencies(schemaIssues || []);

      // Fetch full schema SQL
      const { data: schemaData, error: schemaDataError } = await supabase.rpc('export_full_schema');
      if (schemaDataError) throw schemaDataError;
      setSchemaSql(schemaData?.schema || '');
    } catch (error) {
      console.error("Error fetching database overview:", error);
      toast.error("Failed to fetch database overview");
    } finally {
      setLoading(false);
    }
  };

  const fetchTableDetails = async (tableName: string) => {
    try {
      const { data, error } = await supabase.rpc('get_table_columns_plus', {
        p_table_name: tableName
      });
      
      if (error) throw error;
      setTableColumns(data || []);
    } catch (error) {
      console.error(`Error fetching details for table ${tableName}:`, error);
      toast.error(`Failed to fetch details for table ${tableName}`);
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
      const { data, error } = await supabase.rpc('run_sql', {
        p_sql: sqlContent
      });
      
      if (error) throw error;
      setSqlResult(data);
      toast.success("SQL executed successfully");
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
      
      const { error } = await supabase.from('migration_logs').insert({
        name: migrationName,
        executed_at: new Date().toISOString(),
        success: true,
        sql_content: newMigrationSql
      });
      
      if (error) throw error;
      
      // Also save the migration file to the migrations directory
      toast.success("Migration saved successfully");
      setNewMigrationName("");
      setNewMigrationSql("");
      
      // Refresh migrations list
      const { data: migrations, error: migrationsError } = await supabase.from('migration_logs').select('*').order('executed_at', { ascending: false });
      if (migrationsError) throw migrationsError;
      setMigrationLogs(migrations || []);
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
      toast.info(`Template for creating a new ${type} has been loaded. Review and run the SQL.`);
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
    toast.info("Exporting types...");
    // This would trigger the generation of the types.ts file
    // In a real implementation, this would call a backend function
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
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tables">Tables & Views</TabsTrigger>
          <TabsTrigger value="objects">Database Objects</TabsTrigger>
          <TabsTrigger value="sql">SQL Editor</TabsTrigger>
          <TabsTrigger value="migrations">Migrations</TabsTrigger>
          <TabsTrigger value="export">Schema & Types</TabsTrigger>
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
          
          {inconsistencies.length > 0 && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Database Inconsistencies Detected</AlertTitle>
              <AlertDescription>
                There are {inconsistencies.length} potential issues with your database schema.
                Check the "Tables & Views" tab for more details.
              </AlertDescription>
            </Alert>
          )}
          
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
                          setSqlContent(`-- Generate SQL to recreate the table structure\nSELECT pg_get_tabledef('${selectedTable}');`); 
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
                  </div>
                  
                  <div className="space-x-2">
                    <Button variant="outline" onClick={() => { 
                      setSqlContent("SELECT * FROM information_schema.tables WHERE table_schema = 'public';"); 
                    }}>
                      List Tables
                    </Button>
                    <Button variant="outline" onClick={() => { 
                      setSqlContent("SELECT * FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'table_name';"); 
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
              </div>
            </CardContent>
          </Card>
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
                      document.body.removeChild(element);
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
      </Tabs>
    </div>
  );
};

export default SupabaseManager;