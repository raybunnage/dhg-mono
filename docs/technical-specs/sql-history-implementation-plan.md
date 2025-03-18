# React Implementation Plan for SQL Query History System

## Overview
This document outlines the React implementation plan for integrating a SQL query history system with tagging capabilities into your frontend application. We'll focus on component architecture, state management, and AI integration.

## Project Structure

```
src/
├── components/
│   ├── QueryHistory/
│   │   ├── QueryList.jsx
│   │   ├── QueryDetail.jsx
│   │   ├── QueryEditor.jsx
│   │   ├── TagSelector.jsx
│   │   └── TagCloud.jsx
│   └── common/
│       ├── Button.jsx
│       ├── Modal.jsx
│       └── SearchInput.jsx
├── hooks/
│   ├── useQueryHistory.js
│   ├── useTags.js
│   └── useAIAnalysis.js
├── services/
│   ├── queryHistoryService.js
│   ├── tagService.js
│   └── aiService.js
├── store/
│   ├── queryHistorySlice.js
│   └── tagSlice.js
└── utils/
    ├── sqlFormatter.js
    └── dateUtils.js
```

## Core Components

### 1. QueryList Component
Main component for displaying the history of saved queries with filtering capabilities.

```jsx
import React, { useState, useEffect } from 'react';
import { useQueryHistory } from '../../hooks/useQueryHistory';
import { useTags } from '../../hooks/useTags';
import QueryDetail from './QueryDetail';
import TagCloud from './TagCloud';

const QueryList = () => {
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('last_executed');
  const [selectedQuery, setSelectedQuery] = useState(null);
  
  const { queries, loading, fetchQueries } = useQueryHistory();
  const { tags } = useTags();
  
  useEffect(() => {
    fetchQueries({ 
      tags: selectedTags, 
      searchTerm, 
      sortBy 
    });
  }, [selectedTags, searchTerm, sortBy]);
  
  // Filter, sort, and rendering logic
  
  return (
    <div className="query-history-container">
      <div className="filters">
        <SearchInput 
          value={searchTerm} 
          onChange={setSearchTerm} 
          placeholder="Search queries..." 
        />
        <TagCloud 
          tags={tags} 
          selectedTags={selectedTags} 
          onTagSelect={tag => setSelectedTags([...selectedTags, tag])}
          onTagRemove={tag => setSelectedTags(selectedTags.filter(t => t !== tag))}
        />
        <SortSelector value={sortBy} onChange={setSortBy} />
      </div>
      
      <div className="query-list">
        {loading ? (
          <Spinner />
        ) : (
          queries.map(query => (
            <QueryListItem 
              key={query.id}
              query={query}
              isSelected={selectedQuery?.id === query.id}
              onClick={() => setSelectedQuery(query)}
            />
          ))
        )}
      </div>
      
      {selectedQuery && (
        <QueryDetail 
          query={selectedQuery}
          onClose={() => setSelectedQuery(null)} 
        />
      )}
    </div>
  );
};
```

### 2. QueryEditor Component
Component for creating and editing SQL queries with AI assistance.

```jsx
import React, { useState } from 'react';
import { useAIAnalysis } from '../../hooks/useAIAnalysis';
import { useQueryHistory } from '../../hooks/useQueryHistory';
import CodeEditor from '../common/CodeEditor';
import TagSelector from './TagSelector';

const QueryEditor = ({ initialQuery = null }) => {
  const [queryText, setQueryText] = useState(initialQuery?.query_text || '');
  const [queryName, setQueryName] = useState(initialQuery?.query_name || '');
  const [description, setDescription] = useState(initialQuery?.description || '');
  const [tags, setTags] = useState(initialQuery?.tags || []);
  
  const { saveQuery, updateQuery } = useQueryHistory();
  const { 
    analyzeQuery, 
    suggestName, 
    suggestDescription, 
    suggestTags, 
    loading: aiLoading 
  } = useAIAnalysis();
  
  const handleAnalyzeWithAI = async () => {
    if (!queryText.trim()) return;
    
    const analysis = await analyzeQuery(queryText);
    if (analysis) {
      setQueryName(prev => prev || analysis.name);
      setDescription(prev => prev || analysis.description);
      setTags(prev => [...new Set([...prev, ...analysis.tags])]);
    }
  };
  
  const handleSave = async () => {
    if (!queryText.trim()) return;
    
    const queryData = {
      query_text: queryText,
      query_name: queryName,
      description,
      tags
    };
    
    if (initialQuery) {
      await updateQuery(initialQuery.id, queryData);
    } else {
      await saveQuery(queryData);
    }
  };
  
  return (
    <div className="query-editor">
      <div className="editor-header">
        <input
          type="text"
          value={queryName}
          onChange={e => setQueryName(e.target.value)}
          placeholder="Query Name"
        />
        <Button 
          onClick={handleAnalyzeWithAI} 
          disabled={!queryText.trim() || aiLoading}
        >
          {aiLoading ? 'Analyzing...' : 'Analyze with AI'}
        </Button>
      </div>
      
      <CodeEditor
        value={queryText}
        onChange={setQueryText}
        language="sql"
      />
      
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="Description"
      />
      
      <TagSelector
        selectedTags={tags}
        onTagsChange={setTags}
      />
      
      <div className="editor-actions">
        <Button onClick={handleSave}>
          {initialQuery ? 'Update Query' : 'Save Query'}
        </Button>
      </div>
    </div>
  );
};
```

### 3. TagSelector Component
Reusable component for selecting and managing tags.

```jsx
import React, { useState, useEffect } from 'react';
import { useTags } from '../../hooks/useTags';

const TagSelector = ({ selectedTags = [], onTagsChange }) => {
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  
  const { tags, createTag } = useTags();
  
  useEffect(() => {
    if (input.trim()) {
      const filtered = tags
        .filter(tag => 
          tag.toLowerCase().includes(input.toLowerCase()) && 
          !selectedTags.includes(tag)
        )
        .slice(0, 5);
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  }, [input, tags, selectedTags]);
  
  const handleAddTag = async (tag) => {
    if (!tag.trim() || selectedTags.includes(tag)) return;
    
    // If it's a new tag, create it
    if (!tags.includes(tag)) {
      await createTag(tag);
    }
    
    onTagsChange([...selectedTags, tag]);
    setInput('');
  };
  
  const handleRemoveTag = (tag) => {
    onTagsChange(selectedTags.filter(t => t !== tag));
  };
  
  return (
    <div className="tag-selector">
      <div className="selected-tags">
        {selectedTags.map(tag => (
          <div key={tag} className="tag">
            {tag}
            <button onClick={() => handleRemoveTag(tag)}>×</button>
          </div>
        ))}
      </div>
      
      <div className="tag-input-container">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Add tags..."
          onKeyDown={e => {
            if (e.key === 'Enter' && input.trim()) {
              handleAddTag(input);
              e.preventDefault();
            }
          }}
        />
        
        {suggestions.length > 0 && (
          <ul className="tag-suggestions">
            {suggestions.map(tag => (
              <li 
                key={tag} 
                onClick={() => handleAddTag(tag)}
              >
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
```

## Custom Hooks

### 1. useQueryHistory.js
Hook for managing query history operations.

```javascript
import { useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  fetchQueriesAsync, 
  saveQueryAsync, 
  updateQueryAsync,
  deleteQueryAsync,
  toggleFavoriteAsync
} from '../store/queryHistorySlice';

export const useQueryHistory = () => {
  const dispatch = useDispatch();
  const { 
    queries, 
    loading, 
    error 
  } = useSelector(state => state.queryHistory);
  
  const fetchQueries = useCallback((filters = {}) => {
    dispatch(fetchQueriesAsync(filters));
  }, [dispatch]);
  
  const saveQuery = useCallback(async (queryData) => {
    return dispatch(saveQueryAsync(queryData)).unwrap();
  }, [dispatch]);
  
  const updateQuery = useCallback(async (queryId, queryData) => {
    return dispatch(updateQueryAsync({ queryId, queryData })).unwrap();
  }, [dispatch]);
  
  const deleteQuery = useCallback(async (queryId) => {
    return dispatch(deleteQueryAsync(queryId)).unwrap();
  }, [dispatch]);
  
  const toggleFavorite = useCallback(async (queryId) => {
    return dispatch(toggleFavoriteAsync(queryId)).unwrap();
  }, [dispatch]);
  
  const executeQuery = useCallback(async (queryId) => {
    // Implementation for executing a query
    // This might involve another service/API
  }, []);
  
  return {
    queries,
    loading,
    error,
    fetchQueries,
    saveQuery,
    updateQuery,
    deleteQuery,
    toggleFavorite,
    executeQuery
  };
};
```

### 2. useAIAnalysis.js
Hook for AI-powered query analysis features.

```javascript
import { useState, useCallback } from 'react';
import { aiService } from '../services/aiService';

export const useAIAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const analyzeQuery = useCallback(async (queryText) => {
    if (!queryText.trim()) return null;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await aiService.analyzeQuery(queryText);
      return {
        name: response.suggestedName,
        description: response.suggestedDescription,
        tags: response.suggestedTags
      };
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const suggestName = useCallback(async (queryText) => {
    if (!queryText.trim()) return '';
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await aiService.suggestName(queryText);
      return response.suggestedName;
    } catch (err) {
      setError(err.message);
      return '';
    } finally {
      setLoading(false);
    }
  }, []);
  
  const suggestDescription = useCallback(async (queryText) => {
    // Similar to suggestName
  }, []);
  
  const suggestTags = useCallback(async (queryText) => {
    // Similar to suggestName but returns array of tags
  }, []);
  
  return {
    loading,
    error,
    analyzeQuery,
    suggestName,
    suggestDescription,
    suggestTags
  };
};
```

## Service Layer

### 1. queryHistoryService.js
Service for interacting with the backend API for query operations.

```javascript
import { api } from './api';

export const queryHistoryService = {
  fetchQueries: async (filters = {}) => {
    const { 
      tags = [], 
      searchTerm = '', 
      sortBy = 'created_at',
      page = 1,
      pageSize = 20
    } = filters;
    
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (sortBy) params.append('sort_by', sortBy);
    params.append('page', page.toString());
    params.append('page_size', pageSize.toString());
    
    tags.forEach(tag => params.append('tags[]', tag));
    
    const response = await api.get(`/query-history?${params.toString()}`);
    return response.data;
  },
  
  getQueryById: async (queryId) => {
    const response = await api.get(`/query-history/${queryId}`);
    return response.data;
  },
  
  saveQuery: async (queryData) => {
    const response = await api.post('/query-history', queryData);
    return response.data;
  },
  
  updateQuery: async (queryId, queryData) => {
    const response = await api.put(`/query-history/${queryId}`, queryData);
    return response.data;
  },
  
  deleteQuery: async (queryId) => {
    await api.delete(`/query-history/${queryId}`);
    return { id: queryId };
  },
  
  toggleFavorite: async (queryId) => {
    const response = await api.post(`/query-history/${queryId}/toggle-favorite`);
    return response.data;
  },
  
  incrementExecution: async (queryId, status) => {
    const response = await api.post(`/query-history/${queryId}/increment-execution`, { status });
    return response.data;
  }
};
```

### 2. aiService.js
Service for interacting with AI models for query analysis.

```javascript
import { api } from './api';

export const aiService = {
  analyzeQuery: async (queryText) => {
    const response = await api.post('/ai/analyze-query', { queryText });
    return response.data;
  },
  
  suggestName: async (queryText) => {
    const response = await api.post('/ai/suggest-name', { queryText });
    return response.data;
  },
  
  suggestDescription: async (queryText) => {
    const response = await api.post('/ai/suggest-description', { queryText });
    return response.data;
  },
  
  suggestTags: async (queryText) => {
    const response = await api.post('/ai/suggest-tags', { queryText });
    return response.data;
  }
};
```

## Redux Store

### queryHistorySlice.js
Redux slice for managing query history state.

```javascript
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { queryHistoryService } from '../services/queryHistoryService';

export const fetchQueriesAsync = createAsyncThunk(
  'queryHistory/fetchQueries',
  async (filters) => {
    return await queryHistoryService.fetchQueries(filters);
  }
);

export const saveQueryAsync = createAsyncThunk(
  'queryHistory/saveQuery',
  async (queryData) => {
    return await queryHistoryService.saveQuery(queryData);
  }
);

// Additional async thunks for other operations

const queryHistorySlice = createSlice({
  name: 'queryHistory',
  initialState: {
    queries: [],
    loading: false,
    error: null,
    currentQuery: null
  },
  reducers: {
    setCurrentQuery: (state, action) => {
      state.currentQuery = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchQueriesAsync.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchQueriesAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.queries = action.payload;
      })
      .addCase(fetchQueriesAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message;
      })
      // Additional cases for other async operations
  }
});

export const { setCurrentQuery } = queryHistorySlice.actions;
export default queryHistorySlice.reducer;
```

## AI Integration Implementation

### AI Integration for Query Analysis
Create a component to handle AI-powered query analysis:

```jsx
import React, { useState } from 'react';
import { useAIAnalysis } from '../../hooks/useAIAnalysis';

const AIAnalysisPanel = ({ queryText, onApplySuggestions }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  
  const { analyzeQuery } = useAIAnalysis();
  
  const handleAnalyze = async () => {
    setAnalyzing(true);
    
    try {
      const results = await analyzeQuery(queryText);
      setSuggestions(results);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setAnalyzing(false);
    }
  };
  
  return (
    <div className="ai-analysis-panel">
      <button 
        onClick={handleAnalyze}
        disabled={analyzing || !queryText.trim()}
      >
        {analyzing ? 'Analyzing...' : 'Analyze with AI'}
      </button>
      
      {suggestions && (
        <div className="suggestions">
          <h4>AI Suggestions</h4>
          
          <div className="suggestion-item">
            <h5>Name</h5>
            <p>{suggestions.name}</p>
          </div>
          
          <div className="suggestion-item">
            <h5>Description</h5>
            <p>{suggestions.description}</p>
          </div>
          
          <div className="suggestion-item">
            <h5>Tags</h5>
            <div className="tag-list">
              {suggestions.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          </div>
          
          <button onClick={() => onApplySuggestions(suggestions)}>
            Apply Suggestions
          </button>
        </div>
      )}
    </div>
  );
};
```

## Implementation Phases

### Phase 1: Basic Query Management
- Implement QueryList component for viewing saved queries
- Create QueryEditor component for saving/editing queries
- Set up Redux store and API services

### Phase 2: Tagging System
- Implement TagSelector and TagCloud components
- Add tag filtering in QueryList
- Create tag management functionality

### Phase 3: AI Integration
- Implement AI service integration
- Add AI analysis to QueryEditor
- Create suggestion application UI

### Phase 4: Advanced Features
- Add execution tracking
- Implement favorites system
- Create sharing functionality
- Add export/import capabilities

## Considerations for AI Builder App Integration

### 1. AI API Configuration
- Ensure AI service URLs are configurable
- Set up proper error handling for AI service outages
- Implement fallbacks when AI suggestions aren't available

### 2. Component Adaptability
- Make components reusable through props
- Use theming variables for styling
- Implement responsive design for all components

### 3. State Management
- Use context or Redux for global state
- Implement proper loading states
- Handle error states gracefully

### 4. Performance Considerations
- Implement pagination for query lists
- Use virtualization for large lists
- Debounce inputs for search and filtering

## Testing Strategy

### Unit Tests
- Test individual components with Jest and React Testing Library
- Mock API calls and Redux store

### Integration Tests
- Test component interactions
- Verify Redux flow

### End-to-End Tests
- Test complete user flows with Cypress
- Verify AI integration with mocked responses
