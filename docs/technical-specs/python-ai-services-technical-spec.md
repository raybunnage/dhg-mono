# Technical Specification: Python AI Services for Monorepo

## Overview

This document outlines the technical specification for a Python-based AI services architecture designed to handle complex AI workflows within a monorepo structure. These services will act as the "backend" for AI processing tasks, while the React frontend applications will handle user interactions and API calls to these services.

## Problem Statement

Complex AI workflows require significant processing power and sophisticated libraries for tasks such as:
1. Document classification and analysis
2. Natural language processing
3. Content generation and transformation
4. Data extraction and enrichment
5. Integration with AI APIs like Claude

These tasks are challenging to implement directly in frontend code due to:
- Performance limitations in browser environments
- Complexity of AI libraries and dependencies
- Security concerns with API keys and sensitive data
- Resource-intensive processing requirements

## Proposed Solution

A Python-based AI services architecture that provides:
1. Dedicated microservices for specific AI tasks
2. RESTful API endpoints for frontend integration
3. Shared utilities for common AI operations
4. Centralized configuration and logging

### Project Structure

```
packages/
├── ai-services/
│   ├── src/
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── app.py                # FastAPI application
│   │   │   ├── routes/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── document.py       # Document processing endpoints
│   │   │   │   ├── classification.py # Classification endpoints
│   │   │   │   └── generation.py     # Content generation endpoints
│   │   │   └── middleware/
│   │   │       ├── __init__.py
│   │   │       ├── auth.py           # Authentication middleware
│   │   │       └── logging.py        # Logging middleware
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── file_service.py       # File operations
│   │   │   ├── claude_service.py     # Claude API integration
│   │   │   ├── classification_service.py # Document classification
│   │   │   └── report_service.py     # Report generation
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── document.py           # Document models
│   │   │   ├── prompt.py             # Prompt models
│   │   │   └── classification.py     # Classification models
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── logger.py             # Logging utilities
│   │       ├── config.py             # Configuration management
│   │       └── exceptions.py         # Custom exceptions
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_file_service.py
│   │   ├── test_claude_service.py
│   │   └── test_classification_service.py
│   ├── pyproject.toml                # Project dependencies
│   ├── setup.py                      # Package setup
│   ├── requirements.txt              # Dependencies
│   └── README.md
└── ai-cli/                           # Optional CLI for direct service access
    ├── src/
    │   ├── __init__.py
    │   ├── commands/
    │   │   ├── __init__.py
    │   │   ├── classify.py           # Classification command
    │   │   └── generate.py           # Generation command
    │   └── main.py                   # CLI entry point
    ├── pyproject.toml
    ├── setup.py
    └── README.md
```

### Core Components

#### 1. FastAPI Application

Provides RESTful endpoints for frontend integration:

```python
# app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routes import document, classification, generation
from .middleware import auth, logging

app = FastAPI(title="AI Services API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add custom middleware
app.middleware("http")(logging.log_requests)
app.middleware("http")(auth.verify_api_key)

# Include routers
app.include_router(document.router, prefix="/documents", tags=["Documents"])
app.include_router(classification.router, prefix="/classification", tags=["Classification"])
app.include_router(generation.router, prefix="/generation", tags=["Generation"])

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

#### 2. File Service

Handles file operations:

```python
# file_service.py
import os
from pathlib import Path
from typing import Dict, Optional, Any
import logging

logger = logging.getLogger(__name__)

class FileService:
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = Path(base_dir) if base_dir else Path.cwd()
        logger.debug(f"Initialized FileService with base directory: {self.base_dir}")
    
    def read_file(self, file_path: str) -> Dict[str, Any]:
        """Read a file and return its contents with metadata."""
        try:
            path = self._resolve_path(file_path)
            logger.debug(f"Reading file: {path}")
            
            if not path.exists():
                logger.error(f"File not found: {path}")
                return {
                    "success": False,
                    "error": f"File not found: {path}",
                    "path": str(path),
                    "content": None
                }
            
            content = path.read_text(encoding="utf-8")
            stats = path.stat()
            
            return {
                "success": True,
                "error": None,
                "path": str(path),
                "content": content,
                "stats": {
                    "size": stats.st_size,
                    "modified": stats.st_mtime,
                    "lines": content.count("\n") + 1
                }
            }
        except Exception as e:
            logger.exception(f"Error reading file {file_path}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "path": file_path,
                "content": None
            }
    
    def write_file(self, file_path: str, content: str) -> Dict[str, Any]:
        """Write content to a file."""
        try:
            path = self._resolve_path(file_path)
            logger.debug(f"Writing to file: {path}")
            
            # Ensure directory exists
            path.parent.mkdir(parents=True, exist_ok=True)
            
            path.write_text(content, encoding="utf-8")
            
            return {
                "success": True,
                "error": None,
                "path": str(path)
            }
        except Exception as e:
            logger.exception(f"Error writing to file {file_path}: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "path": file_path
            }
    
    def _resolve_path(self, file_path: str) -> Path:
        """Resolve a file path relative to the base directory."""
        path = Path(file_path)
        if path.is_absolute():
            return path
        return self.base_dir / path
```

#### 3. Claude Service

Handles interactions with the Claude API:

```python
# claude_service.py
import logging
import httpx
from typing import Dict, List, Any, Optional
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class Message(BaseModel):
    role: str
    content: List[Dict[str, Any]]

class ClaudeRequest(BaseModel):
    model: str
    messages: List[Message]
    max_tokens: Optional[int] = 4000
    temperature: Optional[float] = 0

class ClaudeService:
    def __init__(self, api_key: str, model: str = "claude-3-7-sonnet-20250219"):
        self.api_key = api_key
        self.default_model = model
        self.api_url = "https://api.anthropic.com/v1/messages"
        logger.debug(f"Initialized ClaudeService with model: {model}")
    
    async def call_claude_api(self, request: ClaudeRequest) -> Dict[str, Any]:
        """Make a request to the Claude API."""
        try:
            logger.debug(f"Calling Claude API with model: {request.model}")
            
            headers = {
                "Content-Type": "application/json",
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01"
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.api_url,
                    json=request.dict(),
                    headers=headers,
                    timeout=60.0
                )
                
                logger.debug(f"Claude API response status: {response.status_code}")
                
                if response.status_code == 200:
                    return {
                        "success": True,
                        "result": response.json(),
                        "error": None
                    }
                else:
                    error_msg = f"Claude API error: {response.status_code} - {response.text}"
                    logger.error(error_msg)
                    return {
                        "success": False,
                        "result": None,
                        "error": error_msg
                    }
        except Exception as e:
            error_msg = f"Error calling Claude API: {str(e)}"
            logger.exception(error_msg)
            return {
                "success": False,
                "result": None,
                "error": error_msg
            }
    
    async def classify_document(
        self, 
        document: str, 
        prompt: str, 
        context: str,
        model: Optional[str] = None
    ) -> Dict[str, Any]:
        """Classify a document using Claude."""
        try:
            logger.info("Classifying document with Claude")
            
            request = ClaudeRequest(
                model=model or self.default_model,
                messages=[
                    Message(
                        role="user",
                        content=[
                            {
                                "type": "text",
                                "text": f"""I need you to analyze and classify a markdown document according to our document types.

Here is the prompt for classification:
{prompt}

Here is the context:
{context}

Now, please analyze the following markdown document and classify it according to the document types:

{document}

Please provide your classification in JSON format, including the document type ID, name, and explanation for your choice. Also include any metadata you can extract from the document."""
                            }
                        ]
                    )
                ]
            )
            
            return await self.call_claude_api(request)
        except Exception as e:
            error_msg = f"Error classifying document: {str(e)}"
            logger.exception(error_msg)
            return {
                "success": False,
                "result": None,
                "error": error_msg
            }
```

#### 4. Classification Service

Orchestrates the document classification workflow:

```python
# classification_service.py
import logging
from typing import Dict, List, Any, Optional
from ..models.document import Document
from ..models.classification import ClassificationResult
from .file_service import FileService
from .claude_service import ClaudeService

logger = logging.getLogger(__name__)

class ClassificationService:
    def __init__(
        self,
        file_service: FileService,
        claude_service: ClaudeService,
        supabase_url: str,
        supabase_key: str
    ):
        self.file_service = file_service
        self.claude_service = claude_service
        self.supabase_url = supabase_url
        self.supabase_key = supabase_key
        logger.debug("Initialized ClassificationService")
    
    async def classify_markdown(
        self,
        file_path: str,
        prompt_name: str = "markdown-document-classification-prompt"
    ) -> Dict[str, Any]:
        """Classify a markdown document using the specified prompt."""
        try:
            logger.info(f"Starting classification of {file_path}")
            
            # 1. Read the target file
            file_result = self.file_service.read_file(file_path)
            if not file_result["success"]:
                error_msg = f"Failed to read file: {file_result['error']}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "result": None
                }
            
            # 2. Get the classification prompt from Supabase
            prompt = await self._get_prompt_by_name(prompt_name)
            if not prompt:
                error_msg = f"Classification prompt not found: {prompt_name}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "result": None
                }
            
            # 3. Get related assets
            relationships = await self._get_relationships_by_prompt_id(prompt["id"])
            
            # 4. Process related assets
            related_assets = []
            for rel in relationships:
                asset_content = self.file_service.read_file(rel["asset_path"])
                document_type = None
                if rel.get("document_type_id"):
                    document_type = await self._get_document_type_by_id(rel["document_type_id"])
                
                related_assets.append({
                    "relationship": rel,
                    "content": asset_content["content"] if asset_content["success"] else None,
                    "document_type": document_type,
                    "success": asset_content["success"],
                    "error": asset_content["error"]
                })
            
            # 5. Get document types
            document_types = await self._get_document_types_by_category("Documentation")
            
            # 6. Prepare context for AI
            context = self._prepare_context(document_types, related_assets)
            
            # 7. Call Claude API
            claude_response = await self.claude_service.classify_document(
                file_result["content"],
                prompt["content"],
                context
            )
            
            if not claude_response["success"]:
                error_msg = f"Claude API call failed: {claude_response['error']}"
                logger.error(error_msg)
                return {
                    "success": False,
                    "error": error_msg,
                    "result": None
                }
            
            # 8. Process and return the result
            return {
                "success": True,
                "error": None,
                "result": claude_response["result"],
                "metadata": {
                    "file_path": file_path,
                    "prompt_id": prompt["id"],
                    "document_types_count": len(document_types),
                    "related_assets_count": len(related_assets)
                }
            }
        except Exception as e:
            error_msg = f"Error during classification: {str(e)}"
            logger.exception(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "result": None
            }
    
    async def _get_prompt_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Get a prompt from Supabase by name."""
        # Implementation using supabase-py
        pass
    
    async def _get_relationships_by_prompt_id(self, prompt_id: str) -> List[Dict[str, Any]]:
        """Get relationships from Supabase by prompt ID."""
        # Implementation using supabase-py
        pass
    
    async def _get_document_type_by_id(self, document_type_id: str) -> Optional[Dict[str, Any]]:
        """Get a document type from Supabase by ID."""
        # Implementation using supabase-py
        pass
    
    async def _get_document_types_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Get document types from Supabase by category."""
        # Implementation using supabase-py
        pass
    
    def _prepare_context(
        self,
        document_types: List[Dict[str, Any]],
        related_assets: List[Dict[str, Any]]
    ) -> str:
        """Prepare context for the Claude API."""
        context = f"Document Types with category 'Documentation':\n{document_types}\n\n"
        
        for asset in related_assets:
            if asset["success"]:
                context += f"\n--- Related Asset: {asset['relationship']['asset_path']} ---\n"
                if asset["relationship"].get("relationship_context"):
                    context += f"Context: {asset['relationship']['relationship_context']}\n\n"
                context += f"{asset['content']}\n\n"
        
        return context
```

#### 5. API Endpoints

Exposes the services via RESTful endpoints:

```python
# routes/classification.py
from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, Form
from typing import Dict, Any, Optional
from ..services.classification_service import ClassificationService
from ..utils.config import get_settings
from ..services.file_service import FileService
from ..services.claude_service import ClaudeService

router = APIRouter()

def get_classification_service():
    settings = get_settings()
    file_service = FileService(settings.base_dir)
    claude_service = ClaudeService(settings.anthropic_api_key)
    return ClassificationService(
        file_service,
        claude_service,
        settings.supabase_url,
        settings.supabase_key
    )

@router.post("/classify-markdown")
async def classify_markdown(
    file: UploadFile = File(...),
    prompt_name: str = Form("markdown-document-classification-prompt"),
    service: ClassificationService = Depends(get_classification_service)
):
    """Classify a markdown document using AI."""
    try:
        # Save the uploaded file temporarily
        temp_file_path = f"temp/{file.filename}"
        with open(temp_file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Classify the document
        result = await service.classify_markdown(temp_file_path, prompt_name)
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/classify-from-path")
async def classify_from_path(
    file_path: str,
    prompt_name: Optional[str] = "markdown-document-classification-prompt",
    service: ClassificationService = Depends(get_classification_service)
):
    """Classify a markdown document from a file path."""
    try:
        result = await service.classify_markdown(file_path, prompt_name)
        
        if not result["success"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Configuration Management

```python
# config.py
import os
from pathlib import Path
from pydantic import BaseSettings
from functools import lru_cache
from dotenv import load_dotenv

# Load environment variables from .env files
env_files = [
    ".env",
    "apps/dhg-improve-experts/.env.development"
]

for env_file in env_files:
    if Path(env_file).exists():
        load_dotenv(env_file)

class Settings(BaseSettings):
    app_name: str = "AI Services"
    base_dir: str = str(Path.cwd())
    log_level: str = "INFO"
    
    # API keys
    anthropic_api_key: str = os.getenv("VITE_ANTHROPIC_API_KEY", "")
    
    # Supabase
    supabase_url: str = os.getenv("VITE_SUPABASE_URL", "")
    supabase_key: str = os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY", "")
    
    # API settings
    api_key_header: str = "X-API-Key"
    api_key: str = os.getenv("AI_SERVICES_API_KEY", "")
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
```

## Implementation Plan

### Phase 1: Core Services and Infrastructure

1. Set up Python project structure with FastAPI
2. Implement FileService with comprehensive testing
3. Implement ClaudeService for AI API interactions
4. Implement basic configuration and logging

### Phase 2: Classification Workflow and API

1. Implement ClassificationService
2. Develop Supabase integration for data retrieval
3. Create API endpoints for classification
4. Add comprehensive error handling and logging

### Phase 3: Integration and Deployment

1. Create Docker configuration for services
2. Implement React hooks for API integration
3. Set up CI/CD pipeline for deployment
4. Add monitoring and observability

## Dependencies

- **FastAPI**: Modern, high-performance web framework
- **Pydantic**: Data validation and settings management
- **httpx**: Asynchronous HTTP client
- **supabase-py**: Python client for Supabase
- **python-dotenv**: Environment variable management
- **uvicorn**: ASGI server for FastAPI
- **pytest**: Testing framework
- **pytest-asyncio**: Async testing support

## Integration with React Frontend

### React Hook Example

```typescript
// useAIClassification.ts
import { useState } from 'react';
import axios from 'axios';

const AI_SERVICES_URL = process.env.REACT_APP_AI_SERVICES_URL || 'http://localhost:8000';

interface ClassificationResult {
  success: boolean;
  error?: string;
  result?: any;
  metadata?: {
    file_path: string;
    prompt_id: string;
    document_types_count: number;
    related_assets_count: number;
  };
}

export const useAIClassification = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const classifyMarkdown = async (file: File, promptName?: string): Promise<ClassificationResult> => {
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (promptName) {
        formData.append('prompt_name', promptName);
      }
      
      const response = await axios.post(
        `${AI_SERVICES_URL}/classification/classify-markdown`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      setResult(response.data.result);
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Unknown error';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };
  
  const classifyFromPath = async (filePath: string, promptName?: string): Promise<ClassificationResult> => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.post(
        `${AI_SERVICES_URL}/classification/classify-from-path`,
        {
          file_path: filePath,
          prompt_name: promptName
        }
      );
      
      setResult(response.data.result);
      return response.data;
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || err.message || 'Unknown error';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setLoading(false);
    }
  };

  return {
    classifyMarkdown,
    classifyFromPath,
    loading,
    error,
    result
  };
};
```

### React Component Example

```tsx
// DocumentClassifier.tsx
import React, { useState } from 'react';
import { useAIClassification } from '../hooks/useAIClassification';

const DocumentClassifier: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const { classifyMarkdown, loading, error, result } = useAIClassification();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    
    await classifyMarkdown(file);
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Document Classifier</h1>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label className="block mb-2">Select Markdown File</label>
          <input 
            type="file" 
            accept=".md,.markdown" 
            onChange={handleFileChange}
            className="border p-2 w-full"
          />
        </div>
        
        <button 
          type="submit" 
          disabled={!file || loading}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-300"
        >
          {loading ? 'Classifying...' : 'Classify Document'}
        </button>
      </form>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 p-4 mb-4 rounded">
          {error}
        </div>
      )}
      
      {result && (
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="text-xl font-bold mb-2">Classification Result</h2>
          <pre className="bg-white p-4 rounded overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default DocumentClassifier;
```

## Deployment

### Docker Configuration

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "src.api.app:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3'

services:
  ai-services:
    build: ./packages/ai-services
    ports:
      - "8000:8000"
    volumes:
      - ./docs:/app/docs
    env_file:
      - ./apps/dhg-improve-experts/.env.development
    environment:
      - LOG_LEVEL=INFO
```

## Comparison with TypeScript CLI Approach

### Python AI Services Advantages

1. **Rich Ecosystem**: Python has a more mature ecosystem for AI/ML tasks with libraries like NumPy, pandas, scikit-learn, and spaCy
2. **Performance**: Better performance for compute-intensive tasks
3. **Separation of Concerns**: Clear separation between frontend and backend
4. **Scalability**: Can be deployed as microservices and scaled independently
5. **API-First Design**: Provides a standard interface for multiple frontend applications
6. **Language Specialization**: Uses Python for what it's best at (data processing, AI) and JavaScript/TypeScript for UI

### TypeScript CLI Advantages

1. **Language Consistency**: Same language across frontend and backend
2. **Simpler Setup**: No need for separate services or API calls
3. **Type Safety**: End-to-end type safety with TypeScript
4. **Deployment Simplicity**: Easier to deploy as part of the monorepo
5. **Direct Integration**: Can be directly called from Node.js scripts

### When to Choose Python AI Services

Choose the Python AI Services approach when:

1. You need advanced AI capabilities beyond what's easily available in JavaScript
2. Performance is critical for processing large documents or complex AI tasks
3. You want to share AI services across multiple applications or platforms
4. You need to scale AI processing independently from the frontend
5. Your team has Python expertise or wants to leverage Python's AI ecosystem

### When to Choose TypeScript CLI

Choose the TypeScript CLI approach when:

1. You want to maintain a single language throughout your stack
2. Your AI processing needs are relatively straightforward
3. You prefer direct function calls over API requests
4. You want to avoid the complexity of managing separate services
5. Your team is more comfortable with TypeScript than Python

## Conclusion

The Python AI Services approach provides a powerful foundation for implementing complex AI workflows in a monorepo structure. By leveraging Python's rich ecosystem for AI and data processing while keeping the frontend in React, you get the best of both worlds: sophisticated AI capabilities and modern, responsive user interfaces.

This architecture allows for clear separation of concerns, with the frontend handling user interactions and the Python services handling the heavy computational work. The RESTful API design ensures that these services can be used by multiple applications within your monorepo, promoting code reuse and maintainability.

While this approach requires more initial setup than the TypeScript CLI approach, it offers greater scalability, performance, and flexibility for complex AI tasks. The investment in this architecture will pay dividends as your AI capabilities grow and evolve. 