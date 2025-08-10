# Supabase Database Schema

## Core Tables Overview

### 1. user_profiles (Main user table)
- **id**: uuid (primary key)
- **email**: varchar (unique)
- **full_name**: varchar
- **role**: 'user'|'creator'|'admin'
- **subscription_tier**: 'free'|'pro'|'enterprise'
- **credits_remaining**: integer (default 100)
- **total_spent**: numeric (default 0.0)
- **preferences**: jsonb
- **timezone**, **language**, **avatar_url**
- **created_at**, **updated_at**, **last_login**

### 2. clones (AI Expert Profiles)
- **id**: uuid (primary key)
- **creator_id**: uuid → user_profiles(id)
- **name**: varchar
- **description**: varchar
- **bio**: text
- **avatar_url**: varchar
- **category**: varchar
- **expertise_areas**: text[]
- **base_price**: numeric
- **personality_traits**: jsonb
- **is_published**, **is_active**: boolean
- **total_sessions**, **total_earnings**: numeric
- **average_rating**: numeric (0.0-5.0)
- **total_ratings**: integer

### 3. sessions (User-Clone Interactions)
- **id**: uuid (primary key)
- **user_id**: uuid → user_profiles(id)
- **clone_id**: uuid → clones(id)
- **session_type**: 'chat'|'voice'|'video'
- **status**: 'active'|'paused'|'ended'
- **start_time**, **end_time**: timestamp
- **duration_minutes**: integer
- **rate_per_minute**: numeric
- **total_cost**: numeric
- **message_count**: integer
- **user_rating**: 1-5 stars
- **user_feedback**: text

### 4. messages (Session Messages)
- **id**: uuid (primary key)
- **session_id**: uuid → sessions(id)
- **sender_type**: 'user'|'ai'
- **content**: text
- **cost_increment**: numeric
- **tokens_used**: integer

### 5. documents (Knowledge Base Files)
- **id**: uuid (primary key)
- **clone_id**: uuid → clones(id)
- **title**, **file_name**, **file_path**: varchar
- **file_type**, **file_size_bytes**: varchar/integer
- **processing_status**: 'pending'|'processing'|'completed'|'failed'
- **chunk_count**: integer

### 6. document_chunks (Processed Document Pieces)
- **id**: uuid (primary key)
- **document_id**: uuid → documents(id)
- **content**: text
- **chunk_index**: integer
- **embedding**: vector
- **doc_metadata**: jsonb

### 7. user_analytics (Daily User Stats)
- **user_id**: uuid → user_profiles(id)
- **date**: date
- **sessions_count**, **messages_sent**: integer
- **total_duration_minutes**: integer
- **total_spent**: numeric
- **documents_uploaded**: integer

### 8. creator_analytics (Daily Creator Stats)
- **creator_id**: uuid → user_profiles(id)
- **clone_id**: uuid → clones(id)
- **date**: date
- **total_earnings**: numeric
- **sessions_count**: integer
- **average_rating**: numeric
- **user_retention_rate**: numeric

## Key Relationships
- Users can be creators (user_profiles.role = 'creator')
- Creators can have multiple clones
- Users have sessions with clones
- Sessions contain messages
- Clones can have documents/knowledge base
- Analytics track user and creator performance