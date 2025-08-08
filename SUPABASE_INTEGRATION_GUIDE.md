# Supabase Integration Guide 🚀

Since you already have Supabase set up with the 21 tables, here's how to configure the CloneAI application to use your Supabase database:

## 🔧 **Quick Setup Steps**

### **Option 1: Interactive Setup (Recommended)**

Run the interactive setup script:

```bash
cd backend
./venv/bin/python setup_supabase.py
```

This will prompt you for:
- Supabase URL
- Public Anon Key  
- Service Role Key
- JWT Secret
- Database Password

### **Option 2: Manual Configuration**

Update `backend/.env` with your Supabase credentials:

```bash
# Supabase Configuration (PRIMARY DATABASE)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-public-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
SUPABASE_JWT_SECRET=your-jwt-secret

# Supabase Database URL (for direct PostgreSQL connection)
DATABASE_URL=postgresql+asyncpg://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres
```

## 📋 **Where to Find Your Credentials**

In your Supabase dashboard:

1. **Project URL & API Keys**: Settings → API
   - `SUPABASE_URL`: Project URL
   - `SUPABASE_KEY`: anon public key
   - `SUPABASE_SERVICE_KEY`: service_role secret key

2. **JWT Secret**: Settings → API → JWT Settings
   - `SUPABASE_JWT_SECRET`: JWT Secret

3. **Database Password**: Settings → Database → Connection parameters
   - Database password for direct PostgreSQL connection

## ✅ **Verification Steps**

After configuration:

### **1. Verify Tables Exist**
```bash
cd backend
./venv/bin/python verify_supabase_tables.py
```

### **2. Test Database Connection**
```bash
cd backend  
./venv/bin/python test_db_connection.py
```

### **3. Start the Application**
```bash
# Backend
cd backend
./venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8001

# Frontend  
npm run dev
```

## 🎯 **Expected Table List (21 Tables)**

Your Supabase should have these tables:
- `user_profiles` - User accounts
- `refresh_tokens` - Authentication tokens
- `clones` - AI expert clones  
- `documents` - Uploaded documents
- `document_chunks` - Text chunks for RAG
- `knowledge_entries` - Direct knowledge entries
- `chat_sessions` - Chat sessions
- `chat_messages` - Chat messages
- `sessions` - User sessions
- `messages` - Session messages
- `session_summaries` - AI-generated summaries
- `summary_templates` - Summary templates
- `bulk_summarization_jobs` - Bulk processing jobs
- `user_analytics` - User usage analytics
- `creator_analytics` - Creator analytics  
- `user_memory_contexts` - User memory/context
- `conversation_memories` - Conversation memories
- `clone_learning` - AI learning data
- `memory_policies` - Memory management policies
- `memory_usage_stats` - Memory usage statistics
- `alembic_version` - Migration tracking

## 🔒 **Security Notes**

- Keep your `SERVICE_KEY` secure - it has admin access
- Use `ANON_KEY` for client-side operations
- Never expose service keys in frontend code
- Database password should be kept secret

## 🚀 **Benefits of Supabase Integration**

- ✅ **Managed PostgreSQL** with pgvector support
- ✅ **Built-in Authentication** and user management
- ✅ **Real-time subscriptions** for live features
- ✅ **Storage** for file uploads
- ✅ **Edge Functions** for serverless computing
- ✅ **Automatic backups** and scaling
- ✅ **Dashboard** for database management

## 🛠️ **Troubleshooting**

### **Connection Issues:**
- Verify URL format: `https://xxx.supabase.co`
- Check database password is correct
- Ensure project is not paused
- Verify network connectivity

### **Permission Issues:**
- Check Row Level Security (RLS) policies
- Verify service key has proper permissions
- Review Supabase logs in dashboard

### **Table Issues:**
- Run migrations if tables are missing
- Check table permissions in Supabase dashboard
- Verify schema matches expected structure

---

**Once configured, your CloneAI application will have:**
- ✅ Production-ready Supabase database
- ✅ Built-in authentication system  
- ✅ Real-time chat capabilities
- ✅ Vector search for AI features
- ✅ Scalable cloud infrastructure

**Ready to launch! 🎉**