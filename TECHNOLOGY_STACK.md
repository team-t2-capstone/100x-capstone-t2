# CloneAI Platform - Technology Stack Documentation

## Overview
The CloneAI platform is built using modern, scalable technologies optimized for AI-powered applications with real-time chat capabilities, vector search, and robust billing systems.

## Architecture Diagram
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend       │    │    Backend       │    │   External      │
│   (Next.js)     │◄──►│   (FastAPI)      │◄──►│   Services      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                        │
         │              ┌─────────▼─────────┐              │
         │              │    Supabase       │              │
         │              │  (PostgreSQL +    │              │
         └──────────────┤   Auth + Storage) │              │
                        └───────────────────┘              │
                                                          │
         ┌─────────────────────────────────────────────────┤
         │                                                 │
    ┌────▼────┐  ┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼─────┐
    │ OpenAI  │  │    Lago     │  │ WebSocket   │  │   CDN     │
    │   API   │  │  Billing    │  │   Server    │  │ Storage   │
    └─────────┘  └─────────────┘  └─────────────┘  └───────────┘
```

---

## Frontend Stack

### **Next.js 15.2.4**
- **Framework**: React-based full-stack framework
- **Features Used**:
  - App Router for file-based routing
  - Server-side rendering (SSR)
  - Static site generation (SSG)
  - API routes for backend integration
  - Built-in performance optimizations

### **React 19**
- **UI Library**: Latest React version with concurrent features
- **Features Used**:
  - React Server Components
  - Concurrent rendering
  - Suspense for data fetching
  - Error boundaries

### **TypeScript 5**
- **Language**: Type-safe JavaScript
- **Benefits**: Better developer experience, fewer runtime errors
- **Configuration**: Strict mode enabled

### **Styling & UI**

#### **Tailwind CSS 3.4.17**
- **Utility-first CSS framework**
- **Custom Design System**: Consistent spacing, colors, typography
- **Responsive Design**: Mobile-first approach
- **Dark Mode**: Built-in dark theme support

#### **Radix UI**
- **Accessible Components**: 
  - Dialogs, Dropdowns, Navigation
  - Form components with proper ARIA
  - Keyboard navigation support
- **Headless Components**: Full styling control

#### **Lucide React**
- **Icon Library**: 1000+ SVG icons
- **Consistent Design**: Unified icon style
- **Tree Shaking**: Only used icons bundled

### **State Management**
- **React Context**: For global app state
- **React Hooks**: useState, useEffect, useReducer
- **SWR/TanStack Query**: Server state management (recommended for data fetching)

### **Real-time Communication**
- **WebSocket API**: Native browser WebSocket
- **Socket.IO Client**: For reliable real-time chat (alternative)
- **React WebSocket Hook**: Custom hook for connection management

---

## Backend Stack

### **FastAPI (Python)**
- **Modern API Framework**: High-performance, easy to use
- **Features**:
  - Automatic API documentation (OpenAPI/Swagger)
  - Type hints and validation (Pydantic)
  - Async/await support
  - WebSocket support for real-time features
  - Dependency injection system

### **Python Libraries**

#### **Core Dependencies**
```python
fastapi==0.104.1
uvicorn==0.24.0        # ASGI server
pydantic==2.5.0        # Data validation
python-multipart==0.0.6 # File uploads
```

#### **Database & ORM**
```python
asyncpg==0.29.0        # PostgreSQL async driver
sqlalchemy==2.0.23     # ORM
alembic==1.13.1        # Database migrations
```

#### **Authentication & Security**
```python
python-jose[cryptography]==3.3.0  # JWT tokens
passlib[bcrypt]==1.7.4            # Password hashing
python-multipart==0.0.6           # Form data parsing
```

#### **AI & Vector Operations**
```python
openai==1.3.8          # OpenAI API client
numpy==1.24.3          # Numerical operations
tiktoken==0.5.2        # Token counting for OpenAI
sentence-transformers==2.2.2  # Alternative embeddings
```

#### **File Processing**
```python
PyPDF2==3.0.1          # PDF text extraction
python-docx==0.8.11    # Word document processing
beautifulsoup4==4.12.2 # Web scraping
aiofiles==23.2.1       # Async file operations
```

#### **Background Tasks**
```python
celery==5.3.4          # Distributed task queue
redis==5.0.1           # Task broker
```

### **API Architecture**

#### **Project Structure**
```
backend/
├── app/
│   ├── main.py                 # FastAPI app initialization
│   ├── config.py              # Configuration settings
│   ├── database.py            # Database connection
│   ├── api/
│   │   ├── __init__.py
│   │   ├── auth.py            # Authentication endpoints
│   │   ├── clones.py          # Clone management
│   │   ├── chat.py            # Chat and sessions
│   │   ├── knowledge.py       # Knowledge base
│   │   └── analytics.py       # Analytics endpoints
│   ├── core/
│   │   ├── security.py        # JWT and security
│   │   ├── middleware.py      # Custom middleware
│   │   └── exceptions.py      # Error handling
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py           # User models
│   │   ├── clone.py          # Clone models
│   │   └── session.py        # Session models
│   ├── services/
│   │   ├── __init__.py
│   │   ├── ai_service.py     # OpenAI integration
│   │   ├── rag_service.py    # RAG implementation
│   │   ├── billing_service.py # Billing integration
│   │   └── websocket_service.py # WebSocket management
│   └── utils/
│       ├── __init__.py
│       ├── embeddings.py     # Vector operations
│       ├── document_processor.py # File processing
│       └── validators.py     # Custom validators
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

---

## Database Stack

### **Supabase (PostgreSQL 15)**
- **Managed PostgreSQL**: Cloud-hosted database
- **Features Used**:
  - Row Level Security (RLS)
  - Real-time subscriptions
  - Built-in authentication
  - File storage
  - Vector operations (pgvector)

### **PostgreSQL Extensions**
```sql
-- Required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- UUID generation
CREATE EXTENSION IF NOT EXISTS "vector";       -- Vector similarity search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- Full-text search
```

### **Vector Database**
- **pgvector**: PostgreSQL extension for vector operations
- **Embedding Dimensions**: 1536 (OpenAI text-embedding-3-large)
- **Similarity Search**: Cosine similarity with IVFFlat index
- **Performance**: Optimized for <1M vectors per clone

---

## AI & Machine Learning Stack

### **OpenAI API Integration**

#### **Models Used**
```python
# Text Generation
GPT_4_MODEL = "gpt-4-turbo-preview"
GPT_4_MINI = "gpt-4o-mini"  # For less complex tasks

# Embeddings  
EMBEDDING_MODEL = "text-embedding-3-large"  # 1536 dimensions

# Function Calling
FUNCTIONS_MODEL = "gpt-4-turbo"  # For structured outputs
```

#### **Usage Patterns**
1. **Document Processing**: GPT-4 for text extraction and cleaning
2. **Embeddings**: text-embedding-3-large for vector search
3. **Chat Responses**: GPT-4 with RAG context
4. **Summarization**: GPT-4 for session summaries
5. **Analysis**: GPT-4 for conversation insights

### **RAG (Retrieval-Augmented Generation) Pipeline**

#### **Document Processing Flow**
```python
# 1. Document Ingestion
document → text_extraction → chunking → embedding → vector_storage

# 2. Query Processing  
user_query → query_embedding → similarity_search → context_retrieval

# 3. Response Generation
retrieved_context + user_query → GPT-4 → response + citations
```

#### **RAG Configuration**
```python
RAG_CONFIG = {
    "chunk_size": 1000,           # Tokens per chunk
    "chunk_overlap": 200,         # Overlap between chunks
    "similarity_threshold": 0.7,   # Minimum similarity score
    "max_context_length": 8000,   # Max tokens for context
    "max_retrieved_chunks": 10    # Max chunks per query
}
```

---

## External Services

### **Payment Processing**

#### **Lago (Open Source Billing)**
- **Usage-Based Billing**: Perfect for session-based pricing
- **Features**:
  - Real-time usage tracking
  - Multiple pricing models
  - Invoice generation
  - Payment processor agnostic
- **Integration**: REST API + Webhooks

#### **Payment Processors**
- **Primary**: Stripe Connect for card payments
- **Alternative**: PayPal for international users
- **Crypto**: BTCPay Server for Bitcoin payments (optional)

### **File Storage**
- **Supabase Storage**: Primary file storage
- **CDN**: Built-in CDN for fast global delivery
- **Security**: Signed URLs for secure access

### **Real-time Communication**
- **WebSocket Server**: Built into FastAPI
- **Redis**: For WebSocket message persistence
- **Scaling**: Redis Cluster for horizontal scaling

---

## Development & Deployment

### **Development Tools**

#### **Backend Development**
```python
# Development dependencies
pytest==7.4.3              # Testing framework
pytest-asyncio==0.21.1     # Async testing
black==23.11.0              # Code formatting
flake8==6.1.0              # Linting
mypy==1.7.1                # Type checking
```

#### **Frontend Development**
```json
{
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^18",
    "eslint": "^8",
    "eslint-config-next": "15.2.4",
    "typescript": "^5"
  }
}
```

### **Database Migrations**
```python
# Alembic for database migrations
alembic init migrations
alembic revision --autogenerate -m "Initial migration"
alembic upgrade head
```

### **Environment Configuration**
```python
# Environment variables
DATABASE_URL=postgresql://user:pass@localhost/cloneai
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
LAGO_API_KEY=xxx
REDIS_URL=redis://localhost:6379
```

---

## Production Infrastructure

### **Containerization**

#### **Docker Configuration**
```dockerfile
# Backend Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### **Docker Compose**
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    depends_on:
      - redis
      
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
      
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### **Deployment Options**

#### **Option 1: Vercel + Railway**
- **Frontend**: Vercel (Next.js optimized)
- **Backend**: Railway (Python FastAPI)
- **Database**: Supabase (managed)
- **Redis**: Upstash (managed)

#### **Option 2: AWS**
- **Frontend**: AWS Amplify
- **Backend**: AWS ECS/Fargate
- **Database**: AWS RDS (PostgreSQL)
- **Cache**: AWS ElastiCache (Redis)
- **Storage**: AWS S3 + CloudFront

#### **Option 3: Self-hosted**
- **Server**: Ubuntu 22.04 LTS
- **Reverse Proxy**: Nginx
- **SSL**: Let's Encrypt
- **Process Manager**: PM2 or systemd
- **Monitoring**: Prometheus + Grafana

---

## Performance & Scaling

### **Database Optimization**
```sql
-- Vector index for similarity search
CREATE INDEX ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops);

-- Query optimization indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_messages_session_id ON messages(session_id);
```

### **Caching Strategy**
```python
# Redis caching layers
- User sessions: 30 minutes
- API responses: 5 minutes
- Vector search results: 1 hour
- Static content: 24 hours
```

### **Rate Limiting**
```python
# API rate limits
- Authentication: 5 req/min
- Chat messages: 60 req/min  
- File uploads: 10 req/hour
- General API: 1000 req/hour
```

### **Horizontal Scaling**
- **Backend**: Multiple FastAPI instances behind load balancer
- **Database**: Read replicas for analytics queries
- **Redis**: Redis Cluster for WebSocket scaling
- **Storage**: CDN for static assets

---

## Security

### **Authentication & Authorization**
```python
# JWT token configuration
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password security
BCRYPT_ROUNDS = 12
MIN_PASSWORD_LENGTH = 8
```

### **Data Protection**
- **Encryption at Rest**: Database and file storage encrypted
- **Encryption in Transit**: HTTPS/WSS for all communications
- **Row Level Security**: Database-level access control
- **API Security**: Rate limiting, CORS, input validation

### **GDPR Compliance**
- **Data Deletion**: User data cleanup functions
- **Data Export**: User data export functionality
- **Privacy Controls**: Granular privacy settings
- **Audit Logging**: User action tracking

---

## Monitoring & Observability

### **Application Monitoring**
```python
# Logging framework
import structlog

# Metrics collection
- Response times
- Error rates  
- Database query performance
- OpenAI API usage and costs
```

### **Health Checks**
```python
# Health check endpoints
GET /health              # Basic health
GET /health/detailed     # Service status
GET /health/db          # Database connectivity
GET /health/ai          # OpenAI API status
```

### **Error Tracking**
- **Sentry**: Error tracking and performance monitoring
- **Custom Logging**: Structured logging with correlation IDs
- **Alerting**: Email/Slack notifications for critical errors

---

## Cost Optimization

### **OpenAI API Costs**
```python
# Cost estimation per 1000 active users/month
- Chat (GPT-4): ~$500-1500
- Embeddings: ~$50-100  
- Summarization: ~$200-400
- Total AI costs: ~$750-2000/month
```

### **Infrastructure Costs**
```python
# Monthly costs (1000 users)
- Supabase: $25-100
- Vercel/Railway: $50-200
- Redis: $15-50
- CDN: $10-30
- Total infrastructure: ~$100-380/month
```

### **Cost Optimization Strategies**
1. **Token Management**: Optimize prompt engineering
2. **Caching**: Cache expensive API calls
3. **Model Selection**: Use GPT-4o-mini for simple tasks
4. **Batch Processing**: Batch similar operations
5. **Monitoring**: Track and alert on cost spikes

---

## Future Considerations

### **Scalability Improvements**
- **Vector Database**: Migrate to specialized vector DB (Pinecone/Weaviate)
- **Microservices**: Split monolith into domain services
- **Event Sourcing**: For better audit trails and scalability
- **GraphQL**: For flexible frontend data fetching

### **AI Enhancements**
- **Fine-tuning**: Custom models for specific domains
- **Multi-modal**: Support for image and audio processing
- **Agent Framework**: LangChain/AutoGPT integration
- **Local LLMs**: Self-hosted models for sensitive data

### **Feature Additions**
- **Mobile Apps**: React Native or native apps
- **API SDK**: Client libraries for third-party integrations
- **Webhooks**: Real-time integrations
- **Analytics Dashboard**: Advanced reporting and insights

This technology stack provides a solid foundation for building a scalable, AI-powered expert consultation platform with modern web technologies and best practices.