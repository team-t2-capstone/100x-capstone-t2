# 100x Capstone T2 - AI Clone Platform

## 🚀 Overview
A comprehensive AI Clone Platform that enables users to create, interact with, and monetize AI versions of experts. Built with modern technologies including Next.js 15, React 19, TypeScript, and a powerful Python FastAPI backend with RAG integration.

## 🏗️ Architecture

### Frontend (Next.js)
- **Framework**: Next.js 15 with App Router
- **UI**: React 19 + TypeScript + Tailwind CSS
- **Components**: shadcn/ui component library (43+ components)
- **State**: React hooks + custom state management
- **Authentication**: Supabase Auth integration

### Backend (FastAPI)
- **Framework**: Python FastAPI with async support
- **Database**: Supabase PostgreSQL
- **AI Integration**: OpenAI GPT models + RAG system
- **Authentication**: JWT tokens + Supabase Auth
- **File Storage**: Supabase Storage
- **Voice/Video**: ElevenLabs integration

### Database (Supabase)
- **Primary DB**: PostgreSQL with Row Level Security (RLS)
- **Storage**: Document and media file storage
- **Real-time**: Supabase Realtime for live updates
- **Authentication**: Built-in auth with JWT

## 🎯 Key Features

### 🤖 AI Clone Creation & Management
- **Multi-step Clone Wizard**: Comprehensive clone creation flow
- **Document Upload**: RAG-powered knowledge base integration
- **Voice Training**: Custom voice cloning with ElevenLabs
- **Testing & Preview**: Real-time clone testing interface
- **Clone Publishing**: Public/private clone management

### 💬 Multi-Modal Interactions
- **Session Pages**: Unified session interface for all interaction types
- **Text Chat**: Real-time messaging with AI clones
- **Voice Sessions**: Audio conversations with voice-cloned experts
- **Video Calls**: Face-to-face interactions (future enhancement)
- **Category-Aware Responses**: Expert type-specific conversation flows

### 📚 Knowledge Management
- **Document Upload**: Support for PDF, DOC, TXT, MD files
- **Duplicate Detection**: Smart duplicate file detection
- **Document Removal**: Complete cleanup of documents and AI resources
- **Expert Updates**: Automatic knowledge base refreshing via `/expert/update`
- **RAG Integration**: Vector search and retrieval augmented generation

### 🏪 Discovery & Marketplace
- **Expert Discovery**: Browse and filter AI clones by category
- **Session Navigation**: Direct clone-to-session routing
- **Expert Profiles**: Detailed clone information and capabilities
- **Pricing Models**: Flexible pricing for different interaction types

### 🔐 Authentication & Security
- **User Management**: Secure authentication with Supabase
- **Row Level Security**: Database-level security policies
- **JWT Tokens**: Secure API communication
- **Creator Access Control**: Clone ownership and permissions

## 📁 Project Structure

```
100x-capstone-t2/
├── app/                        # Next.js App Router pages
│   ├── session/[id]/          # 🆕 Unified session interface
│   ├── discover/              # Expert discovery page  
│   ├── create-clone/wizard/   # Clone creation wizard
│   ├── upload/                # Document management interface
│   ├── dashboard/             # User & creator dashboards
│   ├── profile/               # User profile management
│   └── ...                    # Other core pages
├── components/                 # Reusable React components
│   ├── ui/                    # shadcn/ui component library
│   ├── document-upload/       # 🆕 Enhanced document upload system
│   ├── wizard/                # Clone creation components
│   └── voice-training.tsx     # Voice training interface
├── backend/                   # Python FastAPI backend
│   ├── app/
│   │   ├── api/               # API endpoints
│   │   │   ├── clones.py      # Clone management (fixed description→bio)
│   │   │   ├── rag_memory.py  # RAG system integration
│   │   │   ├── documents.py   # Document management
│   │   │   └── sessions.py    # Session management
│   │   ├── services/          # Business logic services
│   │   │   ├── rag_client.py  # RAG system client (with delete methods)
│   │   │   └── elevenlabs_service.py # Voice cloning service
│   │   └── models/            # Database models and schemas
│   └── requirements.txt       # Python dependencies
├── hooks/                     # Custom React hooks
│   ├── use-rag.ts            # RAG system integration
│   ├── use-billing.ts        # Billing management
│   └── use-voice-upload.ts   # Voice file management
├── lib/                      # Utility libraries
│   ├── clone-api.ts          # Clone API client (fixed bio mapping)
│   ├── knowledge-api.ts      # Document management API
│   └── rag-api-client.ts     # RAG system client
└── ...                       # Configuration files
```

## 🆕 Recent Major Updates

### Session Page Implementation
- **New Route**: `/session/[id]` for unified clone interactions
- **Multi-Modal Support**: Text, voice, and video modes with dynamic UI
- **Real-time Features**: Session timing, cost calculation, connection status
- **Category-Aware**: Different responses based on expert type (medical, business, etc.)
- **Navigation Update**: Discover page now routes directly to sessions

### Enhanced Document Management
- **Upload Integration**: Automatic `/expert/update` calls after document uploads
- **Document Display**: Visual list of existing documents with status indicators
- **Document Removal**: Complete cleanup including:
  - File deletion from Supabase Storage
  - OpenAI vector store removal
  - AI assistant cleanup
  - Database record deletion
- **Error Handling**: Comprehensive error management with user feedback

### Database Schema Fixes
- **Column Mapping**: Fixed `description` → `bio` column mapping issues
- **RLS Policies**: Enabled Row Level Security with proper access policies
- **Data Consistency**: Resolved frontend/backend data mapping inconsistencies

### API Improvements
- **Document Deletion**: New `DELETE /clones/{id}/documents/{doc_id}` endpoint
- **Error Resolution**: Fixed 500 errors caused by column name mismatches
- **Authentication**: Enhanced JWT token validation and user verification

## 🛠️ Technology Stack

### Frontend Technologies
- **Next.js 15** - React framework with App Router
- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe JavaScript development
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - High-quality component library
- **Framer Motion** - Animation and interaction library
- **Supabase Client** - Database and auth integration

### Backend Technologies
- **FastAPI** - Modern Python web framework
- **Supabase** - PostgreSQL database with real-time features
- **OpenAI API** - GPT models and vector embeddings
- **ElevenLabs** - Voice cloning and synthesis
- **Pydantic** - Data validation and serialization
- **uvicorn** - ASGI server for production deployment

### Development Tools
- **Claude Code** - AI-powered development assistance
- **ESLint** - Code linting and formatting
- **Prettier** - Code formatting
- **Git** - Version control
- **Supabase CLI** - Database management

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- Supabase account
- OpenAI API key
- ElevenLabs API key (for voice features)

### Installation

#### Frontend Setup
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Add your Supabase and API keys

# Run development server
npm run dev
```

#### Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Add your API keys and configuration

# Run backend server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Database Setup
```bash
# Run Supabase migrations (if any)
# The application will automatically create necessary tables
```

### Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 🎯 Core User Flows

### 1. Clone Creation Flow
1. **Discovery** → Browse existing clones
2. **Create Clone** → Multi-step wizard interface
3. **Basic Info** → Name, category, pricing
4. **Knowledge Upload** → Documents with RAG integration
5. **Voice Training** → Upload voice samples
6. **Testing & Preview** → Real-time clone testing
7. **Publish** → Make clone available

### 2. Session Interaction Flow
1. **Discover** → Browse available clones
2. **Select Clone** → Click clone card
3. **Session Page** → Unified interaction interface
4. **Choose Mode** → Text, voice, or video
5. **Interact** → Real-time conversation with cost tracking
6. **End Session** → Session summary and billing

### 3. Document Management Flow
1. **Upload Page** → Select clone for document management
2. **Document Upload** → Drag & drop or file selection
3. **Duplicate Detection** → Automatic duplicate checking
4. **Expert Update** → Automatic knowledge base refresh
5. **Document Removal** → Complete resource cleanup

## 🔧 Configuration

### Environment Variables

#### Frontend (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

#### Backend (.env)
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENAI_API_KEY=your_openai_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
RAG_API_BASE_URL=your_rag_system_url
JWT_SECRET_KEY=your_jwt_secret
```

### Database Configuration
The application uses Supabase PostgreSQL with the following key tables:
- `clones` - Clone definitions and metadata
- `knowledge` - Document storage and RAG integration
- `sessions` - User interaction sessions
- `documents` - RAG system document references
- `users` - User authentication and profiles

## 🧪 Testing

### Manual Testing
1. **Clone Creation**: Test the complete wizard flow
2. **Document Upload**: Verify upload, duplicate detection, and removal
3. **Session Interactions**: Test text, voice, and video modes
4. **Expert Discovery**: Browse and filter functionality
5. **Authentication**: Login/logout and access control

### API Testing
- **Backend API**: http://localhost:8000/docs (Swagger UI)
- **Health Checks**: GET `/health` endpoint
- **Authentication**: Test JWT token validation

## 🐛 Troubleshooting

### Common Issues

#### "No clones found" in Upload Page
- **Cause**: Column name mismatch (`description` vs `bio`)
- **Solution**: Fixed in latest update - restart servers

#### "Failed to retrieve clone" Error
- **Cause**: Backend API trying to access non-existent `description` column
- **Solution**: Fixed - backend now uses `bio` column correctly

#### Document Upload Failures
- **Check**: Supabase Storage bucket permissions
- **Check**: File size limits (default 10MB)
- **Check**: Supported file types (PDF, DOC, TXT, MD)

#### Session Page Not Loading
- **Check**: Backend server running on port 8000
- **Check**: Clone exists and is published
- **Check**: User authentication status

### Database Issues
```bash
# Check Supabase connection
# Verify RLS policies are enabled
# Check user permissions
```

### Backend Server Issues
```bash
# Restart backend server
cd backend
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Check logs for specific errors
# Verify environment variables
```

## 📚 API Documentation

### Core Endpoints

#### Clone Management
- `GET /api/v1/clones` - List all clones
- `GET /api/v1/clones/{id}` - Get specific clone
- `POST /api/v1/clones` - Create new clone
- `PUT /api/v1/clones/{id}` - Update clone
- `DELETE /api/v1/clones/{id}` - Delete clone

#### Document Management
- `POST /api/v1/clones/{id}/documents/upload` - Upload document
- `DELETE /api/v1/clones/{id}/documents/{doc_id}` - Delete document
- `POST /api/v1/clones/{id}/documents/check-duplicate` - Check duplicates

#### RAG Integration
- `POST /api/v1/rag/expert/update` - Update expert knowledge
- `POST /api/v1/rag/query` - Query expert knowledge

#### Session Management
- `POST /api/v1/sessions` - Create session
- `GET /api/v1/sessions/{id}` - Get session details
- `PUT /api/v1/sessions/{id}` - Update session

## 🔄 Future Enhancements

### Short-term (Next Sprint)
- [ ] Real-time WebSocket integration for chat
- [ ] WebRTC implementation for voice/video calls
- [ ] Payment processing integration
- [ ] Enhanced analytics dashboard
- [ ] Mobile-responsive improvements

### Medium-term
- [ ] Advanced RAG features (multi-document queries)
- [ ] Custom voice model training
- [ ] Clone marketplace with ratings
- [ ] Admin dashboard for platform management
- [ ] API rate limiting and monitoring

### Long-term
- [ ] Mobile app development (React Native)
- [ ] Multi-language support
- [ ] Enterprise features and SSO
- [ ] Advanced AI model customization
- [ ] Blockchain integration for clone ownership

## 👥 Contributing

### Development Workflow
1. Create feature branch from `main`
2. Implement changes with proper testing
3. Update documentation as needed
4. Submit pull request with detailed description
5. Code review and merge

### Code Standards
- **TypeScript**: Use strict type checking
- **React**: Follow hooks patterns and best practices
- **Python**: Follow PEP 8 style guide
- **Documentation**: Update README for significant changes

## 📄 License

This project is part of the 100x Engineers Capstone program. All rights reserved.

---

## 🔗 Quick Links

- **Live Demo**: [Coming Soon]
- **API Documentation**: http://localhost:8000/docs
- **Supabase Dashboard**: [Your Supabase Project]
- **OpenAI Platform**: https://platform.openai.com
- **ElevenLabs**: https://elevenlabs.io

---

*Last Updated: August 2025*
*Version: 2.0.0 - Major Session & Document Management Update*