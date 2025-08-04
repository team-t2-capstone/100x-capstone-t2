# Clone to Scale - Integration Guide

## 🚀 Complete Setup and Integration Guide

This guide will walk you through setting up the complete Clone to Scale platform from scratch, integrating the frontend and backend, and getting everything running locally.

## 📋 Prerequisites

### System Requirements
- **Node.js** 18+ (for frontend)
- **Python** 3.9+ (for backend)
- **Git** for version control
- **PostgreSQL** (handled by Supabase)

### Required Accounts
- **Supabase** account (free tier available)
- **OpenAI** account with API access
- **Google Cloud Console** (for OAuth)

---

## 🗄️ Step 1: Supabase Database Setup

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create account
2. Create new project
3. Choose a region close to your users
4. Set strong database password
5. Wait for project initialization

### 1.2 Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Copy contents of `backend/supabase/schema.sql`
3. Run the complete schema script
4. Verify all tables are created in **Table Editor**

### 1.3 Configure Row Level Security

The schema automatically enables RLS policies. Verify in **Authentication > Policies** that policies are active.

### 1.4 Get Supabase Credentials

In **Settings > API**, copy:
- Project URL
- `anon` public key  
- `service_role` secret key (for admin operations)

---

## 🔐 Step 2: Google OAuth Setup

### 2.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing
3. Enable **Google+ API** and **OAuth2 API**

### 2.2 Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Choose **External** user type
3. Fill required fields:
   - App name: "Clone to Scale"
   - User support email: your email
   - Authorized domains: your domain
4. Add scopes: `email`, `profile`, `openid`

### 2.3 Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth 2.0 Client IDs**
3. Application type: **Web application**
4. Authorized redirect URIs:
   - `http://localhost:3000/auth/callback` (frontend)
   - `http://localhost:8000/api/auth/google/callback` (backend)
5. Copy **Client ID** and **Client Secret**

---

## 🔧 Step 3: Backend Setup

### 3.1 Install Python Dependencies

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3.2 Configure Environment Variables

Edit `backend/.env` with your actual values:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenAI Configuration
OPENAI_API_KEY=sk-your_openai_api_key
OPENAI_MODEL=gpt-4
OPENAI_FALLBACK_MODEL=gpt-3.5-turbo

# Application Configuration
SECRET_KEY=your_super_secret_key_here_32_chars_min
DEBUG=true

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### 3.3 Start Backend Server

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: `http://localhost:8000`
API documentation: `http://localhost:8000/docs`

---

## 🎨 Step 4: Frontend Setup

### 4.1 Install Dependencies

```bash
cd frontend

# Install dependencies (choose one)
npm install
# or
pnpm install
# or
yarn install
```

### 4.2 Configure Environment Variables

Create `frontend/.env.local`:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_VERSION=v1

# Supabase Configuration (for direct client access)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id

# App Configuration
NEXT_PUBLIC_APP_NAME="Clone to Scale"
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4.3 Update API Integration

The frontend is already structured to work with the backend. You may need to update API endpoints in these files:

- `frontend/lib/api.ts` (if exists)
- `frontend/hooks/useAuth.ts` (if exists)
- Any hardcoded API calls in components

### 4.4 Start Frontend Server

```bash
cd frontend
npm run dev
# or
pnpm dev
# or
yarn dev
```

Frontend will be available at: `http://localhost:3000`

---

## 🔗 Step 5: Frontend-Backend Integration

### 5.1 Update Frontend API Calls

Create `frontend/lib/api.ts`:

```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION || 'v1';

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    GOOGLE: `${API_BASE_URL}/api/auth/google`,
    REFRESH: `${API_BASE_URL}/api/auth/refresh`,
    LOGOUT: `${API_BASE_URL}/api/auth/logout`,
    ME: `${API_BASE_URL}/api/auth/me`,
  },
  
  // Experts
  EXPERTS: {
    SEARCH: `${API_BASE_URL}/api/experts`,
    DETAIL: (id: string) => `${API_BASE_URL}/api/experts/${id}`,
    FEATURED: `${API_BASE_URL}/api/experts/featured/list`,
    CATEGORIES: `${API_BASE_URL}/api/experts/categories/list`,
  },
  
  // Sessions
  SESSIONS: {
    CREATE: `${API_BASE_URL}/api/sessions`,
    DETAIL: (id: string) => `${API_BASE_URL}/api/sessions/${id}`,
    LIST: `${API_BASE_URL}/api/sessions`,
    EXTEND: (id: string) => `${API_BASE_URL}/api/sessions/${id}/extend`,
    END: (id: string) => `${API_BASE_URL}/api/sessions/${id}/end`,
  },
  
  // Chat
  CHAT: {
    SEND_MESSAGE: (sessionId: string) => `${API_BASE_URL}/api/chat/${sessionId}/message`,
    MESSAGES: (sessionId: string) => `${API_BASE_URL}/api/chat/${sessionId}/messages`,
    WEBSOCKET: (sessionId: string) => `ws://localhost:8000/api/chat/${sessionId}/ws`,
  }
};

// API utility functions
export const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = localStorage.getItem('access_token');
  
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  const response = await fetch(endpoint, config);
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }
  
  return response.json();
};
```

### 5.2 Update Authentication Flow

Update your auth components to use the backend API instead of hardcoded data.

### 5.3 Connect Real-time Chat

Update chat components to use the WebSocket connection and REST API endpoints.

---

## 🧪 Step 6: Testing the Integration

### 6.1 Test Authentication

1. Open `http://localhost:3000`
2. Click login/sign up
3. Complete Google OAuth flow
4. Verify user appears in Supabase `users` table

### 6.2 Test Expert Discovery

1. Navigate to expert discovery page
2. Verify experts are loaded from backend
3. Test search and filtering

### 6.3 Test Chat Session

1. Select an expert
2. Start a new session
3. Send messages and verify AI responses
4. Check session appears in Supabase `sessions` table

### 6.4 Verify Database

Check Supabase tables have data:
- `users` - User accounts
- `sessions` - Chat sessions  
- `messages` - Chat messages
- `session_tokens` - Session management

---

## 🐛 Troubleshooting

### Common Issues

**Backend won't start:**
- Check Python version (3.9+)
- Verify all environment variables in `.env`
- Check Supabase credentials
- Ensure virtual environment is activated

**Frontend API calls fail:**
- Verify backend is running on port 8000
- Check CORS configuration in backend
- Verify API_URL in frontend `.env.local`
- Check browser network tab for errors

**Authentication not working:**
- Verify Google OAuth credentials
- Check redirect URIs match exactly
- Ensure Supabase is configured correctly
- Check browser console for errors

**Database errors:**
- Verify Supabase schema was applied correctly
- Check RLS policies are enabled
- Ensure service role key has admin access

### Debug Endpoints

Test these endpoints directly:

- `GET http://localhost:8000/health` - Backend health
- `GET http://localhost:8000/api/info` - API information
- `GET http://localhost:8000/docs` - API documentation

---

## 🚀 Step 7: Production Deployment

### 7.1 Backend Deployment (Railway/Render/Heroku)

1. Set production environment variables
2. Update CORS origins to production frontend URL
3. Set `DEBUG=false`
4. Configure production database
5. Set up monitoring and logging

### 7.2 Frontend Deployment (Vercel/Netlify)

1. Update environment variables for production
2. Set production API URL
3. Configure build settings
4. Set up domain and SSL

### 7.3 Database Migration

Your Supabase project can be used for production, or you can create a separate production instance.

---

## 📝 Next Steps

### Immediate Priorities

1. **Complete Clone Creation Workflow**
   - Implement questionnaire system
   - Add file upload processing
   - Build personality analysis

2. **Payment Integration**
   - Integrate Stripe/payment provider
   - Implement session billing
   - Add payment webhooks

3. **Real-time Features**
   - Enhance WebSocket functionality
   - Add typing indicators
   - Implement session status updates

### Advanced Features

1. **Expert Dashboard**
   - Analytics and earnings
   - Clone management
   - Performance metrics

2. **Advanced AI Features**
   - Voice cloning integration
   - Video avatar support
   - Multi-language support

3. **Enterprise Features**
   - Team accounts
   - API access
   - Custom integrations

---

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section
2. Review logs in backend and frontend
3. Verify all environment variables
4. Test individual components

**Contact Information:**
- Project documentation: `/README.md` files
- API documentation: `http://localhost:8000/docs`
- Database schema: `backend/supabase/schema.sql`

---

*This integration guide should get you from zero to a fully functional Clone to Scale platform. Each step builds on the previous one, so follow them in order for the best results.*