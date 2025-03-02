import { useState, useEffect, Component } from 'react';
import React from 'react';
import { CommandHistoryService } from '../services/commandHistoryService';
import { 
  CommandHistoryResult, 
  FavoriteCommand,
  CommandCategory,
  MostUsedCommand,
  CategoryUsage,
  CommandSuggestion 
} from '../types/commandHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Check, Clock, Copy, FileCog, FileText, ListChecks, Loader2, PanelLeftOpen, Play, Plus, RefreshCw, Terminal, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Error boundary component to handle errors
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error in Commands dashboard:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-md">
          <h2 className="text-xl font-bold text-red-700 mb-2">Something went wrong</h2>
          <p className="text-red-600 mb-4">
            An error occurred while rendering the command dashboard.
          </p>
          <pre className="bg-white p-2 rounded text-sm overflow-auto max-h-[200px]">
            {this.state.error && this.state.error.toString()}
          </pre>
          <Button 
            className="mt-4"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main component
function CmdsContent() {
  const commandHistoryService = new CommandHistoryService();
  
  // State for all data
  const [commandHistory, setCommandHistory] = useState<CommandHistoryResult[]>([]);
  const [favoriteCommands, setFavoriteCommands] = useState<FavoriteCommand[]>([]);
  const [categories, setCategories] = useState<CommandCategory[]>([]);
  const [mostUsedCommands, setMostUsedCommands] = useState<MostUsedCommand[]>([]);
  const [categoryUsage, setCategoryUsage] = useState<CategoryUsage[]>([]);
  const [suggestions, setSuggestions] = useState<CommandSuggestion[]>([]);
  
  // UI state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [successFilter, setSuccessFilter] = useState<boolean | null>(null);
  const [timePeriod, setTimePeriod] = useState(30);
  const [isCommandRunning, setIsCommandRunning] = useState(false);
  const [commandOutput, setCommandOutput] = useState('');
  const [commandInput, setCommandInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [newFavoriteOpen, setNewFavoriteOpen] = useState(false);
  const [newFavorite, setNewFavorite] = useState({
    name: '',
    command_text: '',
    category_id: '',
    description: ''
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load all data
  useEffect(() => {
    loadData();
  }, []);

  // Reload history with filters
  useEffect(() => {
    loadCommandHistory();
  }, [categoryFilter, successFilter, searchTerm]);

  // Reload analytics when time period changes
  useEffect(() => {
    loadAnalytics();
  }, [timePeriod]);

  // Main data loading function
  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadCommandHistory(),
        loadFavoriteCommands(),
        loadCategories(),
        loadAnalytics(),
        loadSuggestions()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
      setErrorMessage('Failed to load data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load command history with filters
  const loadCommandHistory = async () => {
    try {
      const history = await commandHistoryService.getCommandHistory(
        categoryFilter,
        successFilter,
        searchTerm ? searchTerm : undefined
      );
      setCommandHistory(history);
    } catch (error) {
      console.error('Error loading command history:', error);
    }
  };

  // Load favorite commands
  const loadFavoriteCommands = async () => {
    try {
      const favorites = await commandHistoryService.getFavoriteCommands();
      setFavoriteCommands(favorites);
    } catch (error) {
      console.error('Error loading favorite commands:', error);
    }
  };

  // Load categories
  const loadCategories = async () => {
    try {
      const categoryList = await commandHistoryService.getCategories();
      setCategories(categoryList);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  // Load analytics
  const loadAnalytics = async () => {
    try {
      const mostUsed = await commandHistoryService.getMostUsedCommands(timePeriod);
      const byCategory = await commandHistoryService.getCommandUsageByCategory(timePeriod);
      
      setMostUsedCommands(mostUsed);
      setCategoryUsage(byCategory);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  // Load suggestions
  const loadSuggestions = async () => {
    try {
      const suggestionList = await commandHistoryService.getCommandSuggestions();
      setSuggestions(suggestionList);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    }
  };

  // Run a command
  const runCommand = async (command: string, category: string) => {
    if (!command || !category) {
      setErrorMessage('Please enter a command and select a category');
      setTimeout(() => setErrorMessage(null), 3000);
      return;
    }

    setIsCommandRunning(true);
    setCommandOutput('Running command...');

    try {
      // In a real implementation, this would execute the command and get real-time output
      // For the demo, we'll simulate command execution
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const exitCode = Math.random() > 0.8 ? 1 : 0; // Simulate occasional failures
      const success = exitCode === 0;
      const output = success 
        ? `Command executed successfully.\n$ ${command}\nOutput: Command completed in 1.2s`
        : `Command failed with exit code ${exitCode}.\n$ ${command}\nError: Command failed`;
      
      setCommandOutput(output);
      
      // Record the command in history
      await commandHistoryService.recordCommand(
        command,
        category,
        exitCode,
        1200, // Simulate 1.2 seconds execution time
        'Executed from Cmds dashboard'
      );
      
      // Reload command history to show the new command
      loadCommandHistory();
      
    } catch (error) {
      console.error('Error running command:', error);
      setCommandOutput(`Error: Failed to execute command.\n${error}`);
    } finally {
      setIsCommandRunning(false);
    }
  };

  // Run a favorite command
  const runFavoriteCommand = async (favorite: FavoriteCommand) => {
    try {
      // First increment the usage count
      await commandHistoryService.incrementFavoriteCommandUsage(favorite.id);
      
      // Get the category name
      const category = categories.find(c => c.id === favorite.category_id);
      if (!category) {
        throw new Error('Category not found');
      }
      
      // Run the command
      await runCommand(favorite.command_text, category.name);
      
      // Reload favorite commands to update usage count
      loadFavoriteCommands();
    } catch (error) {
      console.error('Error running favorite command:', error);
      setErrorMessage('Failed to run favorite command');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Add a new favorite command
  const addFavoriteCommand = async () => {
    try {
      if (!newFavorite.name || !newFavorite.command_text || !newFavorite.category_id) {
        setErrorMessage('Please fill out all required fields');
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      }
      
      await commandHistoryService.addFavoriteCommand({
        name: newFavorite.name,
        command_text: newFavorite.command_text,
        category_id: newFavorite.category_id,
        description: newFavorite.description || null
      });
      
      setNewFavoriteOpen(false);
      setNewFavorite({
        name: '',
        command_text: '',
        category_id: '',
        description: ''
      });
      
      // Reload favorite commands
      await loadFavoriteCommands();
      
      setSuccessMessage('Favorite command added successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error adding favorite command:', error);
      setErrorMessage('Failed to add favorite command');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  // Copy a command to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccessMessage('Command copied to clipboard');
    setTimeout(() => setSuccessMessage(null), 2000);
  };

  // Format date string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric'
    }).format(date);
  };

  // Format duration
  const formatDuration = (ms: number | null) => {
    if (ms === null) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Get category color
  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.color || '#808080';
  };

  // Get category name
  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  // Calculate success rate color based on percentage
  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'bg-green-100 text-green-800';
    if (rate >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold flex items-center">
          <Terminal className="mr-2" /> Command Dashboard
        </h1>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadData}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" />
            )}
            Refresh
          </Button>
          
          <Dialog open={newFavoriteOpen} onOpenChange={setNewFavoriteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add Favorite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Favorite Command</DialogTitle>
                <DialogDescription>
                  Save a command you use frequently for quick access.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-right">Name</label>
                  <Input 
                    className="col-span-3" 
                    value={newFavorite.name}
                    onChange={(e) => setNewFavorite({...newFavorite, name: e.target.value})}
                    placeholder="e.g., Build Project"
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-right">Command</label>
                  <Input 
                    className="col-span-3"
                    value={newFavorite.command_text}
                    onChange={(e) => setNewFavorite({...newFavorite, command_text: e.target.value})}
                    placeholder="e.g., pnpm build"
                  />
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-right">Category</label>
                  <Select 
                    onValueChange={(value) => setNewFavorite({...newFavorite, category_id: value})}
                    value={newFavorite.category_id}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <label className="text-right">Description</label>
                  <Textarea 
                    className="col-span-3"
                    value={newFavorite.description}
                    onChange={(e) => setNewFavorite({...newFavorite, description: e.target.value})}
                    placeholder="Optional description of what this command does"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewFavoriteOpen(false)}>Cancel</Button>
                <Button onClick={addFavoriteCommand}>Save Command</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      
      {errorMessage && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      
      {successMessage && (
        <Alert className="mb-4 bg-green-50 text-green-800 border-green-200">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}
      
      <Tabs defaultValue="dashboard" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="favorites">Favorites</TabsTrigger>
          <TabsTrigger value="history">Command History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="terminal">Run Commands</TabsTrigger>
        </TabsList>
        
        {/* Dashboard Tab */}
        <TabsContent value="dashboard">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Favorite Commands Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ListChecks className="h-5 w-5 mr-2" />
                  Favorite Commands
                </CardTitle>
                <CardDescription>Your saved commands</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  {favoriteCommands.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No favorite commands yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {favoriteCommands.slice(0, 5).map((favorite) => (
                        <div key={favorite.id} className="flex items-center justify-between p-2 bg-muted rounded-md">
                          <div>
                            <p className="font-medium">{favorite.name}</p>
                            <p className="text-sm text-muted-foreground">{favorite.command_text}</p>
                          </div>
                          <div className="flex space-x-1">
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => copyToClipboard(favorite.command_text)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => runFavoriteCommand(favorite)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" onClick={() => setActiveTab('favorites')}>
                  View All Favorites
                </Button>
              </CardFooter>
            </Card>
            
            {/* Recent Commands Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 mr-2" />
                  Recent Commands
                </CardTitle>
                <CardDescription>Recently executed commands</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  {commandHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No command history yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {commandHistory.slice(0, 5).map((command) => (
                        <div key={command.id} className="p-2 bg-muted rounded-md">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <Badge 
                                variant={command.success ? "default" : "destructive"}
                                className="mr-2"
                              >
                                {command.success ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                              </Badge>
                              <span className="text-sm">{command.category_name}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => copyToClipboard(command.command_text)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-sm font-mono mt-1">{command.sanitized_command}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(command.executed_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" onClick={() => setActiveTab('history')}>
                  View Full History
                </Button>
              </CardFooter>
            </Card>
            
            {/* Command Suggestions Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileCog className="h-5 w-5 mr-2" />
                  Suggested Commands
                </CardTitle>
                <CardDescription>Based on your usage patterns</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  {suggestions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No suggestions available yet. Try running more commands.</p>
                  ) : (
                    <div className="space-y-2">
                      {suggestions.slice(0, 5).map((suggestion, index) => (
                        <div key={index} className="p-2 bg-muted rounded-md">
                          <div className="flex items-center justify-between">
                            <Badge className="mb-1" variant="outline">
                              {suggestion.category_name}
                            </Badge>
                            <Badge 
                              className={
                                suggestion.recommendation_strength === 'high'
                                  ? 'bg-green-100 text-green-800'
                                  : suggestion.recommendation_strength === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }
                            >
                              {suggestion.recommendation_strength}
                            </Badge>
                          </div>
                          <p className="text-sm font-mono">{suggestion.sanitized_command}</p>
                          <div className="flex items-center justify-between mt-1">
                            <p className="text-xs text-muted-foreground">
                              Used {suggestion.usage_count} times
                            </p>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => copyToClipboard(suggestion.sanitized_command)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
              <CardFooter>
                <Button variant="outline" size="sm" onClick={() => setActiveTab('analytics')}>
                  View Analytics
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Most Used Commands */}
            <Card>
              <CardHeader>
                <CardTitle>Most Used Commands</CardTitle>
                <CardDescription>In the last {timePeriod} days</CardDescription>
              </CardHeader>
              <CardContent>
                {mostUsedCommands.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No command usage data yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Command</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead>Success</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mostUsedCommands.slice(0, 5).map((command, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-mono text-sm">
                            {command.command_text}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{command.category_name}</Badge>
                          </TableCell>
                          <TableCell>{command.usage_count}</TableCell>
                          <TableCell>
                            <Badge 
                              className={getSuccessRateColor(command.success_rate)}
                            >
                              {command.success_rate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            
            {/* Category Usage */}
            <Card>
              <CardHeader>
                <CardTitle>Command Categories</CardTitle>
                <CardDescription>Usage by category in the last {timePeriod} days</CardDescription>
              </CardHeader>
              <CardContent>
                {categoryUsage.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No category usage data yet.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead>Success Rate</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryUsage.map((category, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Badge variant="outline">{category.category_name}</Badge>
                          </TableCell>
                          <TableCell>{category.usage_count}</TableCell>
                          <TableCell>
                            <Badge 
                              className={getSuccessRateColor(category.success_rate)}
                            >
                              {category.success_rate}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Favorites Tab */}
        <TabsContent value="favorites">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <ListChecks className="h-5 w-5 mr-2" />
                Favorite Commands
              </CardTitle>
              <CardDescription>
                Commands you've saved for quick access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-end mb-4">
                <Button onClick={() => setNewFavoriteOpen(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Favorite
                </Button>
              </div>
              
              {favoriteCommands.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="mt-2 text-lg font-medium">No favorites yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Add commands you use frequently to your favorites for quick access.
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setNewFavoriteOpen(true)}
                  >
                    Add Your First Favorite
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Command</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Usage</TableHead>
                      <TableHead>Last Used</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {favoriteCommands.map((favorite) => (
                      <TableRow key={favorite.id}>
                        <TableCell className="font-medium">{favorite.name}</TableCell>
                        <TableCell className="font-mono text-sm">{favorite.command_text}</TableCell>
                        <TableCell>
                          <Badge 
                            style={{ 
                              backgroundColor: getCategoryColor(favorite.category_id) + '20',
                              color: getCategoryColor(favorite.category_id)
                            }}
                          >
                            {getCategoryName(favorite.category_id)}
                          </Badge>
                        </TableCell>
                        <TableCell>{favorite.usage_count}</TableCell>
                        <TableCell>
                          {favorite.last_used_at 
                            ? formatDate(favorite.last_used_at)
                            : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => copyToClipboard(favorite.command_text)}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Copy command</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    onClick={() => runFavoriteCommand(favorite)}
                                  >
                                    <Play className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Run command</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PanelLeftOpen className="h-5 w-5 mr-2" />
                Command History
              </CardTitle>
              <CardDescription>
                Log of all commands executed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <Input 
                    placeholder="Search commands..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <Select 
                    value={categoryFilter || 'all'} 
                    onValueChange={(val) => setCategoryFilter(val === 'all' ? null : val)}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.name}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <Select 
                    value={successFilter === null ? 'all' : successFilter ? 'success' : 'failed'}
                    onValueChange={(val) => {
                      if (val === 'all') setSuccessFilter(null);
                      else if (val === 'success') setSuccessFilter(true);
                      else setSuccessFilter(false);
                    }}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="All Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {commandHistory.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                  <h3 className="mt-2 text-lg font-medium">No command history</h3>
                  <p className="text-sm text-muted-foreground">
                    {searchTerm || categoryFilter || successFilter !== null
                      ? 'No commands match your current filters.'
                      : 'Command history will appear here once you start executing commands.'}
                  </p>
                  {(searchTerm || categoryFilter || successFilter !== null) && (
                    <Button 
                      variant="outline" 
                      className="mt-4"
                      onClick={() => {
                        setSearchTerm('');
                        setCategoryFilter(null);
                        setSuccessFilter(null);
                      }}
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Command</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commandHistory.map((command) => (
                      <TableRow key={command.id}>
                        <TableCell className="font-mono text-sm">
                          {command.sanitized_command}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{command.category_name}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(command.executed_at)}
                        </TableCell>
                        <TableCell>
                          {formatDuration(command.duration_ms)}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={command.success ? "default" : "destructive"}
                          >
                            {command.success ? "Success" : "Failed"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => copyToClipboard(command.command_text)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileCog className="h-5 w-5 mr-2" />
                Command Analytics
              </CardTitle>
              <CardDescription>
                Insights into your command usage patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium">Time Period</label>
                <div className="flex gap-2">
                  <Button 
                    variant={timePeriod === 7 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimePeriod(7)}
                  >
                    7 Days
                  </Button>
                  <Button 
                    variant={timePeriod === 30 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimePeriod(30)}
                  >
                    30 Days
                  </Button>
                  <Button 
                    variant={timePeriod === 90 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimePeriod(90)}
                  >
                    90 Days
                  </Button>
                  <Button 
                    variant={timePeriod === 365 ? "default" : "outline"}
                    size="sm"
                    onClick={() => setTimePeriod(365)}
                  >
                    1 Year
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Most Used Commands */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Most Used Commands</h3>
                  {mostUsedCommands.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No command usage data available.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Command</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Usage</TableHead>
                          <TableHead>Success</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mostUsedCommands.map((command, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono text-sm">
                              {command.command_text}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{command.category_name}</Badge>
                            </TableCell>
                            <TableCell>{command.usage_count}</TableCell>
                            <TableCell>
                              <Badge 
                                className={getSuccessRateColor(command.success_rate)}
                              >
                                {command.success_rate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
                
                {/* Category Usage */}
                <div>
                  <h3 className="text-lg font-medium mb-4">Usage By Category</h3>
                  {categoryUsage.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No category usage data available.</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Usage</TableHead>
                          <TableHead>Success Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryUsage.map((category, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Badge variant="outline">{category.category_name}</Badge>
                            </TableCell>
                            <TableCell>{category.usage_count}</TableCell>
                            <TableCell>
                              <Badge 
                                className={getSuccessRateColor(category.success_rate)}
                              >
                                {category.success_rate}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
              
              {/* Command Suggestions */}
              <div className="mt-8">
                <h3 className="text-lg font-medium mb-4">Command Suggestions</h3>
                
                {suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No command suggestions available yet. Execute more commands to generate suggestions.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {suggestions.map((suggestion, index) => (
                      <Card key={index}>
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline">{suggestion.category_name}</Badge>
                            <Badge 
                              className={
                                suggestion.recommendation_strength === 'high'
                                  ? 'bg-green-100 text-green-800'
                                  : suggestion.recommendation_strength === 'medium'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                              }
                            >
                              {suggestion.recommendation_strength}
                            </Badge>
                          </div>
                          <p className="font-mono text-sm mb-2">{suggestion.sanitized_command}</p>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>Used {suggestion.usage_count} times</span>
                            <span>{suggestion.success_rate}% success</span>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Terminal Tab */}
        <TabsContent value="terminal">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Terminal className="h-5 w-5 mr-2" />
                Run Commands
              </CardTitle>
              <CardDescription>
                Execute and track terminal commands
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col space-y-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <label className="mb-2 block text-sm font-medium">Command</label>
                    <Input 
                      placeholder="Enter command..." 
                      value={commandInput}
                      onChange={(e) => setCommandInput(e.target.value)}
                    />
                  </div>
                  
                  <div className="w-full md:w-[200px]">
                    <label className="mb-2 block text-sm font-medium">Category</label>
                    <Select 
                      value={selectedCategory || ''}
                      onValueChange={(value) => setSelectedCategory(value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.name}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="md:self-end">
                    <Button 
                      onClick={() => runCommand(commandInput, selectedCategory || '')}
                      disabled={isCommandRunning || !commandInput || !selectedCategory}
                    >
                      {isCommandRunning ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Execute
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium">Output</label>
                  <div className="font-mono text-sm bg-muted p-4 rounded-md h-[300px] overflow-auto whitespace-pre-wrap">
                    {commandOutput || 'Command output will appear here...'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Export the component wrapped in an error boundary
export default function Cmds() {
  return (
    <ErrorBoundary>
      <CmdsContent />
    </ErrorBoundary>
  );
}