# CloneAI Platform - Comprehensive API Documentation

## Table of Contents
1. [Authentication APIs](#authentication-apis)
2. [User Profile APIs](#user-profile-apis)
3. [Expert Discovery APIs](#expert-discovery-apis)
4. [Clone Management APIs](#clone-management-apis)
5. [Knowledge Base APIs](#knowledge-base-apis)
6. [RAG System APIs](#rag-system-apis)
7. [Session Management APIs](#session-management-apis)
8. [Real-time Chat APIs](#real-time-chat-apis)
9. [Memory Management APIs](#memory-management-apis)
10. [Session Summarization APIs](#session-summarization-apis)
11. [Analytics APIs](#analytics-apis)
12. [Payment & Billing APIs](#payment--billing-apis)

---

## Base URL
```
Production: https://api.cloneai.com
Development: http://localhost:8000
API Version: /api/v1
```

## Authentication
All endpoints require JWT authentication unless specified otherwise.
```
Authorization: Bearer <jwt_token>
```

---

## Authentication APIs

### POST /api/v1/auth/signup
Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "full_name": "John Doe",
  "role": "user" // or "creator"
}
```

**Response:**
```json
{
  "user_id": "uuid",
  "email": "user@example.com",
  "verification_token": "token",
  "message": "Please verify your email"
}
```

### POST /api/v1/auth/login
Authenticate user and return tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "access_token": "jwt_token",
  "refresh_token": "refresh_token",
  "expires_in": 3600,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user"
  }
}
```

### POST /api/v1/auth/refresh-token
Refresh access token.

**Request Body:**
```json
{
  "refresh_token": "refresh_token"
}
```

### POST /api/v1/auth/logout
Logout user and invalidate tokens.

### POST /api/v1/auth/forgot-password
Send password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### POST /api/v1/auth/reset-password
Reset user password with token.

**Request Body:**
```json
{
  "token": "reset_token",
  "new_password": "newSecurePassword123"
}
```

### GET /api/v1/auth/verify-email/{token}
Verify user email address.

---

## User Profile APIs

### GET /api/v1/users/profile
Get current user profile.

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "avatar_url": "https://storage.url/avatar.jpg",
  "role": "user",
  "preferences": {
    "timezone": "UTC",
    "language": "en",
    "notifications": true
  },
  "created_at": "2024-01-01T00:00:00Z"
}
```

### PUT /api/v1/users/profile
Update user profile.

**Request Body:**
```json
{
  "full_name": "John Smith",
  "preferences": {
    "timezone": "EST",
    "language": "en",
    "notifications": false
  }
}
```

### POST /api/v1/users/avatar
Upload user avatar image.

**Request:** Multipart form data with image file.

### DELETE /api/v1/users/account
Delete user account permanently.

---

## Expert Discovery APIs

### GET /api/v1/experts
Get list of expert clones with filtering.

**Query Parameters:**
- `category` (string): Filter by category
- `price_min` (number): Minimum price filter
- `price_max` (number): Maximum price filter
- `rating_min` (number): Minimum rating filter
- `search` (string): Search term
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `sort` (string): Sort by (rating, price, popularity)

**Response:**
```json
{
  "experts": [
    {
      "id": "uuid",
      "name": "Dr. Sarah Chen",
      "description": "Life Coach & Therapist",
      "category": "Life & Coaching",
      "expertise_areas": ["Anxiety Management", "CBT", "Mindfulness"],
      "avatar_url": "https://storage.url/avatar.jpg",
      "base_price": 25.00,
      "rating": 4.9,
      "total_sessions": 1247,
      "is_available": true,
      "next_availability": "2024-01-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  }
}
```

### GET /api/v1/experts/{expert_id}
Get detailed expert profile.

**Response:**
```json
{
  "id": "uuid",
  "name": "Dr. Sarah Chen",
  "description": "Transform your mindset and achieve lasting personal growth",
  "long_description": "Detailed biography and experience...",
  "category": "Life & Coaching",
  "expertise_areas": ["Anxiety Management", "Life Transitions", "CBT"],
  "avatar_url": "https://storage.url/avatar.jpg",
  "base_price": 25.00,
  "rating": 4.9,
  "total_sessions": 1247,
  "credentials": [
    {
      "title": "PhD Psychology",
      "institution": "Stanford University",
      "year": 2015
    }
  ],
  "languages": ["English", "Spanish"],
  "availability": {
    "timezone": "UTC",
    "schedule": {
      "monday": ["09:00", "17:00"],
      "tuesday": ["09:00", "17:00"]
    }
  },
  "reviews": [
    {
      "user_name": "Anonymous",
      "rating": 5,
      "comment": "Excellent session, very helpful",
      "date": "2024-01-01T00:00:00Z"
    }
  ],
  "similar_experts": ["uuid1", "uuid2", "uuid3"]
}
```

### GET /api/v1/experts/categories
Get available expert categories.

**Response:**
```json
{
  "categories": [
    {
      "id": "life-coaching",
      "name": "Life & Coaching",
      "description": "Personal development and life guidance",
      "expert_count": 25,
      "icon": "heart",
      "color": "#f97316"
    }
  ]
}
```

### GET /api/v1/experts/featured
Get featured experts.

### GET /api/v1/experts/recommended
Get personalized expert recommendations.

### GET /api/v1/experts/search
Full-text search experts.

**Query Parameters:**
- `q` (string): Search query
- `category` (string): Category filter
- `price_range` (string): Price range filter

---

## Clone Management APIs

### POST /api/v1/clones
Create a new expert clone.

**Request Body:**
```json
{
  "name": "Dr. John Expert",
  "description": "Business strategy consultant",
  "category": "Business & Strategy",
  "expertise_areas": ["Strategic Planning", "Market Analysis"],
  "base_price": 75.00,
  "bio": "Detailed biography...",
  "credentials": [
    {
      "title": "MBA",
      "institution": "Harvard Business School",
      "year": 2010
    }
  ],
  "languages": ["English"]
}
```

**Response:**
```json
{
  "clone_id": "uuid",
  "status": "draft",
  "setup_steps": [
    {
      "step": "upload_documents",
      "completed": false,
      "description": "Upload your knowledge base documents"
    },
    {
      "step": "configure_personality",
      "completed": false,
      "description": "Define your clone's personality and style"
    }
  ]
}
```

### GET /api/v1/clones
Get current user's clones.

### GET /api/v1/clones/{clone_id}
Get specific clone details.

### PUT /api/v1/clones/{clone_id}
Update clone information.

### DELETE /api/v1/clones/{clone_id}
Delete a clone permanently.

### POST /api/v1/clones/{clone_id}/publish
Publish clone to make it publicly available.

### POST /api/v1/clones/{clone_id}/unpublish
Unpublish clone from public listing.

### GET /api/v1/clones/{clone_id}/analytics
Get clone performance analytics.

**Response:**
```json
{
  "total_sessions": 156,
  "total_earnings": 3900.00,
  "average_rating": 4.7,
  "total_users": 89,
  "session_duration_avg": 42.5,
  "popular_topics": ["Strategic Planning", "Market Analysis"],
  "monthly_trends": {
    "sessions": [12, 15, 18, 22, 25],
    "earnings": [300, 375, 450, 550, 625]
  }
}
```

---

## Knowledge Base APIs

### POST /api/v1/clones/{clone_id}/documents
Upload document to clone's knowledge base.

**Request:** Multipart form data
```
file: [PDF, DOCX, TXT file]
title: "Document Title"
description: "Document description"
tags: ["tag1", "tag2"]
```

**Response:**
```json
{
  "document_id": "uuid",
  "title": "Document Title",
  "processing_status": "processing",
  "file_url": "https://storage.url/document.pdf",
  "chunks_created": 0,
  "estimated_completion": "2024-01-01T10:05:00Z"
}
```

### GET /api/v1/clones/{clone_id}/documents
Get all documents for a clone.

**Response:**
```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "Business Strategy Guide",
      "file_type": "pdf",
      "file_size": 2048576,
      "processing_status": "completed",
      "chunks_count": 45,
      "upload_date": "2024-01-01T00:00:00Z"
    }
  ],
  "total_documents": 12,
  "total_chunks": 450,
  "storage_used_mb": 156.7
}
```

### GET /api/v1/clones/{clone_id}/documents/{doc_id}
Get specific document details.

### DELETE /api/v1/clones/{clone_id}/documents/{doc_id}
Delete document from knowledge base.

### POST /api/v1/clones/{clone_id}/knowledge/text
Add text content directly to knowledge base.

**Request Body:**
```json
{
  "title": "Key Concepts",
  "content": "This is the text content to be added...",
  "category": "concepts",
  "tags": ["important", "basics"]
}
```

### POST /api/v1/clones/{clone_id}/knowledge/url
Add web content to knowledge base.

**Request Body:**
```json
{
  "url": "https://example.com/article",
  "title": "Important Article",
  "scrape_depth": 1,
  "include_links": false
}
```

### GET /api/v1/clones/{clone_id}/knowledge/stats
Get knowledge base statistics.

**Response:**
```json
{
  "total_documents": 25,
  "total_chunks": 1250,
  "storage_used_mb": 456.7,
  "processing_queue": 2,
  "last_updated": "2024-01-01T10:00:00Z",
  "categories": {
    "strategy": 450,
    "analysis": 320,
    "planning": 280,
    "other": 200
  }
}
```

---

## RAG System APIs

### POST /api/v1/clones/{clone_id}/knowledge/search
Search clone's knowledge base.

**Request Body:**
```json
{
  "query": "How to develop a business strategy?",
  "limit": 10,
  "similarity_threshold": 0.7,
  "include_metadata": true
}
```

**Response:**
```json
{
  "results": [
    {
      "chunk_id": "uuid",
      "content": "Business strategy involves...",
      "similarity_score": 0.95,
      "source": {
        "document_title": "Strategy Guide",
        "page": 15,
        "section": "Strategic Planning"
      },
      "metadata": {
        "category": "strategy",
        "tags": ["planning", "analysis"]
      }
    }
  ],
  "query_time_ms": 45,
  "total_results": 8
}
```

### GET /api/v1/clones/{clone_id}/rag/config
Get RAG system configuration.

**Response:**
```json
{
  "chunk_size": 1000,
  "chunk_overlap": 200,
  "similarity_threshold": 0.7,
  "max_context_length": 8000,
  "embedding_model": "text-embedding-3-large",
  "response_model": "gpt-4",
  "temperature": 0.7,
  "max_tokens": 1000
}
```

### PUT /api/v1/clones/{clone_id}/rag/config
Update RAG configuration.

### POST /api/v1/clones/{clone_id}/rag/test
Test RAG pipeline with debug information.

**Request Body:**
```json
{
  "test_query": "What are the key elements of strategic planning?",
  "debug_mode": true
}
```

**Response:**
```json
{
  "response": "Strategic planning involves several key elements...",
  "debug_info": {
    "retrieved_chunks": 5,
    "processing_time_ms": 1250,
    "embedding_time_ms": 150,
    "search_time_ms": 45,
    "generation_time_ms": 1055,
    "context_length": 2450,
    "sources_used": ["doc1", "doc2", "doc3"]
  },
  "retrieved_chunks": [
    {
      "content": "Strategic planning is the process...",
      "similarity_score": 0.92,
      "source": "Strategy Guide - Chapter 3"
    }
  ]
}
```

### GET /api/v1/clones/{clone_id}/rag/metrics
Get RAG system performance metrics.

**Response:**
```json
{
  "retrieval_accuracy": 0.85,
  "average_response_time_ms": 1200,
  "context_utilization": 0.78,
  "source_diversity": 0.65,
  "user_satisfaction": 4.2,
  "total_queries": 1250,
  "successful_retrievals": 1180
}
```

---

## Session Management APIs

### POST /api/v1/sessions
Create a new session.

**Request Body:**
```json
{
  "expert_id": "uuid",
  "session_type": "chat", // "chat", "voice", "video"
  "demo_mode": false,
  "initial_message": "Hi, I need help with business strategy"
}
```

**Response:**
```json
{
  "session_id": "uuid",
  "expert_name": "Dr. Sarah Chen",
  "session_type": "chat",
  "websocket_url": "wss://api.cloneai.com/ws/sessions/uuid",
  "status": "active",
  "start_time": "2024-01-01T10:00:00Z",
  "billing": {
    "rate_per_minute": 1.25,
    "current_cost": 0.00,
    "estimated_cost": 0.00
  }
}
```

### GET /api/v1/sessions/{session_id}
Get session details.

**Response:**
```json
{
  "id": "uuid",
  "expert": {
    "id": "uuid",
    "name": "Dr. Sarah Chen",
    "avatar_url": "https://storage.url/avatar.jpg",
    "expertise_areas": ["Anxiety Management", "CBT"]
  },
  "session_type": "chat",
  "status": "active",
  "start_time": "2024-01-01T10:00:00Z",
  "duration_minutes": 25,
  "total_cost": 31.25,
  "message_count": 18,
  "last_activity": "2024-01-01T10:25:00Z"
}
```

### PUT /api/v1/sessions/{session_id}/status
Update session status.

**Request Body:**
```json
{
  "status": "paused" // "active", "paused", "ended"
}
```

### POST /api/v1/sessions/{session_id}/end
End session and finalize billing.

**Response:**
```json
{
  "session_id": "uuid",
  "final_cost": 43.75,
  "duration_minutes": 35,
  "message_count": 24,
  "summary_available": true,
  "transcript_available": true,
  "rating_requested": true
}
```

### GET /api/v1/sessions/history
Get user's session history.

**Query Parameters:**
- `expert_id` (string): Filter by expert
- `date_from` (string): Start date filter
- `date_to` (string): End date filter
- `page` (number): Page number
- `limit` (number): Items per page

**Response:**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "expert_name": "Dr. Sarah Chen",
      "session_type": "chat",
      "start_time": "2024-01-01T10:00:00Z",
      "duration_minutes": 35,
      "total_cost": 43.75,
      "rating": 5,
      "has_summary": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  },
  "statistics": {
    "total_sessions": 45,
    "total_cost": 1875.50,
    "total_duration_minutes": 1890,
    "average_rating": 4.6
  }
}
```

---

## Real-time Chat APIs

### WebSocket: /ws/sessions/{session_id}
Real-time chat connection.

**Connection:** Requires JWT token in query parameter or header.
```
wss://api.cloneai.com/ws/sessions/{session_id}?token={jwt_token}
```

**Message Types:**

**User Message:**
```json
{
  "type": "user_message",
  "content": "I need help with strategic planning",
  "timestamp": "2024-01-01T10:00:00Z"
}
```

**AI Response:**
```json
{
  "type": "ai_response",
  "content": "I'd be happy to help you with strategic planning...",
  "sources": [
    {
      "title": "Strategy Guide",
      "page": 15,
      "relevance": 0.95
    }
  ],
  "cost_increment": 0.85,
  "processing_time_ms": 1200,
  "timestamp": "2024-01-01T10:00:15Z"
}
```

**Typing Indicator:**
```json
{
  "type": "typing_indicator",
  "is_typing": true
}
```

**Session Update:**
```json
{
  "type": "session_update",
  "duration_minutes": 15,
  "current_cost": 18.75,
  "status": "active"
}
```

**Error Message:**
```json
{
  "type": "error",
  "error_code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many messages sent",
  "retry_after": 30
}
```

### POST /api/v1/sessions/{session_id}/messages
Send message (alternative to WebSocket).

**Request Body:**
```json
{
  "content": "What are the key principles of strategic planning?",
  "message_type": "text",
  "attachments": []
}
```

**Response:**
```json
{
  "message_id": "uuid",
  "ai_response": {
    "content": "Strategic planning involves several key principles...",
    "sources": [...],
    "cost_increment": 0.75
  },
  "session_update": {
    "current_cost": 19.50,
    "duration_minutes": 16
  }
}
```

### GET /api/v1/sessions/{session_id}/messages
Get session message history.

**Query Parameters:**
- `limit` (number): Number of messages to retrieve
- `offset` (number): Message offset
- `message_type` (string): Filter by message type

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "sender_type": "user",
      "content": "Hello, I need help with business strategy",
      "timestamp": "2024-01-01T10:00:00Z"
    },
    {
      "id": "uuid",
      "sender_type": "ai",
      "content": "I'd be happy to help you with business strategy...",
      "sources": [...],
      "timestamp": "2024-01-01T10:00:15Z"
    }
  ],
  "pagination": {
    "total": 24,
    "limit": 50,
    "offset": 0,
    "has_more": false
  }
}
```

---

## Memory Management APIs

### POST /api/v1/sessions/{session_id}/memory
Store important conversation context.

**Request Body:**
```json
{
  "key_points": [
    "User is working on expanding their business internationally",
    "Particularly interested in European markets",
    "Has budget constraints for market research"
  ],
  "user_preferences": {
    "communication_style": "direct",
    "preferred_examples": "tech industry",
    "goals": ["international expansion", "cost optimization"]
  },
  "important_context": "User has 5 years experience in domestic market"
}
```

### GET /api/v1/sessions/{session_id}/memory
Get session-specific memory.

### GET /api/v1/users/{user_id}/memory/profile
Get aggregated user memory profile.

**Response:**
```json
{
  "user_profile": {
    "communication_preferences": {
      "style": "direct",
      "pace": "moderate",
      "detail_level": "comprehensive"
    },
    "goals": [
      {
        "goal": "international expansion",
        "priority": "high",
        "sessions_discussed": 8,
        "progress": "planning_phase"
      }
    ],
    "expertise_areas_discussed": [
      "strategic planning",
      "market analysis",
      "international business"
    ],
    "common_topics": [
      {
        "topic": "market entry strategies",
        "frequency": 12,
        "last_discussed": "2024-01-01T10:00:00Z"
      }
    ]
  },
  "conversation_themes": [
    "business expansion",
    "strategic planning",
    "market analysis"
  ],
  "total_sessions": 15,
  "memory_entries": 45
}
```

### POST /api/v1/memory/cleanup
Clean up old memory entries.

**Request Body:**
```json
{
  "older_than_days": 90,
  "preserve_important": true,
  "compress_old_entries": true
}
```

---

## Session Summarization APIs

### POST /api/v1/sessions/{session_id}/summarize
Generate session summary.

**Request Body:**
```json
{
  "summary_type": "detailed", // "brief", "detailed", "action_items"
  "include_sources": true,
  "focus_areas": ["key_insights", "recommendations", "next_steps"]
}
```

**Response:**
```json
{
  "summary_id": "uuid",
  "summary_text": "In this session, we discussed strategic planning for international expansion...",
  "key_insights": [
    "Market research is crucial before international expansion",
    "European markets offer good opportunities for tech companies",
    "Budget allocation should prioritize high-impact activities"
  ],
  "action_items": [
    {
      "item": "Research European market regulations",
      "priority": "high",
      "estimated_effort": "2-3 weeks"
    },
    {
      "item": "Prepare budget allocation for market entry",
      "priority": "medium",
      "estimated_effort": "1 week"
    }
  ],
  "recommendations": [
    "Consider starting with UK or Germany as entry markets",
    "Allocate 20% of budget for regulatory compliance research"
  ],
  "next_session_topics": [
    "Specific market entry strategies",
    "Regulatory compliance requirements",
    "Partnership opportunities"
  ],
  "sources_referenced": [
    {
      "title": "International Business Strategy",
      "sections": ["Chapter 5: Market Entry", "Chapter 8: Compliance"],
      "relevance": "high"
    }
  ]
}
```

### GET /api/v1/sessions/{session_id}/summary
Get existing session summary.

### PUT /api/v1/sessions/{session_id}/summary
Update session summary with user notes.

**Request Body:**
```json
{
  "user_notes": "This was very helpful. Need to focus on UK market first.",
  "private_notes": "Remember to discuss budget constraints next time",
  "rating": 5,
  "follow_up_needed": true
}
```

### POST /api/v1/sessions/{session_id}/export
Export session transcript and summary.

**Request Body:**
```json
{
  "format": "pdf", // "pdf", "txt", "json"
  "include_summary": true,
  "include_transcript": true,
  "include_sources": true
}
```

**Response:**
```json
{
  "export_id": "uuid",
  "download_url": "https://api.cloneai.com/exports/uuid/download",
  "expires_at": "2024-01-01T12:00:00Z",
  "file_size_mb": 2.5
}
```

### GET /api/v1/users/{user_id}/summaries
Get user's session summaries.

**Query Parameters:**
- `expert_id` (string): Filter by expert
- `date_range` (string): Date range filter
- `category` (string): Filter by session category

---

## Analytics APIs

### GET /api/v1/analytics/dashboard
Get user analytics dashboard.

**Query Parameters:**
- `date_range` (string): "7d", "30d", "90d", "1y"
- `metrics` (string[]): Specific metrics to include

**Response:**
```json
{
  "session_stats": {
    "total_sessions": 45,
    "total_duration_minutes": 1890,
    "average_session_duration": 42,
    "sessions_this_month": 12
  },
  "spending_summary": {
    "total_spent": 1875.50,
    "average_per_session": 41.68,
    "monthly_spend": 495.25,
    "budget_status": "within_limit"
  },
  "favorite_experts": [
    {
      "expert_id": "uuid",
      "name": "Dr. Sarah Chen",
      "sessions": 15,
      "total_cost": 625.75,
      "avg_rating": 4.9
    }
  ],
  "progress_metrics": {
    "goals_set": 8,
    "goals_completed": 3,
    "action_items_completed": 24,
    "progress_score": 0.75
  },
  "category_breakdown": {
    "Life & Coaching": 15,
    "Business & Strategy": 20,
    "Health & Wellness": 10
  }
}
```

### GET /api/v1/analytics/sessions
Get session analytics.

### GET /api/v1/analytics/experts/usage
Get expert usage analytics.

### GET /api/v1/analytics/progress
Get progress tracking analytics.

### GET /api/v1/creators/analytics/dashboard
Get creator analytics dashboard.

**Response:**
```json
{
  "earnings_summary": {
    "total_earnings": 15750.25,
    "this_month": 3240.50,
    "sessions_completed": 425,
    "average_per_session": 37.06
  },
  "session_metrics": {
    "total_sessions": 425,
    "average_duration": 38.5,
    "completion_rate": 0.94,
    "repeat_user_rate": 0.68
  },
  "user_ratings": {
    "average_rating": 4.7,
    "total_reviews": 285,
    "rating_distribution": {
      "5": 180,
      "4": 75,
      "3": 20,
      "2": 7,
      "1": 3
    }
  },
  "performance_trends": {
    "monthly_earnings": [2100, 2450, 2800, 3240],
    "monthly_sessions": [58, 67, 72, 85],
    "satisfaction_trend": [4.5, 4.6, 4.7, 4.7]
  }
}
```

---

## Payment & Billing APIs

### POST /api/v1/billing/customers
Create billing customer profile.

**Request Body:**
```json
{
  "payment_method": {
    "type": "card",
    "card_token": "stripe_card_token"
  },
  "billing_address": {
    "line1": "123 Main St",
    "city": "San Francisco",
    "state": "CA",
    "postal_code": "94105",
    "country": "US"
  }
}
```

### POST /api/v1/billing/sessions/{session_id}/charge
Process session charges.

**Request Body:**
```json
{
  "session_duration_minutes": 35,
  "final_cost": 43.75,
  "cost_breakdown": {
    "base_rate": 1.25,
    "duration_minutes": 35,
    "total": 43.75
  }
}
```

### GET /api/v1/billing/invoices
Get user invoices.

**Response:**
```json
{
  "invoices": [
    {
      "id": "uuid",
      "invoice_number": "INV-2024-001",
      "date": "2024-01-01T00:00:00Z",
      "due_date": "2024-01-15T00:00:00Z",
      "amount": 125.75,
      "status": "paid",
      "sessions": [
        {
          "session_id": "uuid",
          "expert_name": "Dr. Sarah Chen",
          "duration": 35,
          "cost": 43.75
        }
      ]
    }
  ]
}
```

### GET /api/v1/billing/usage
Get usage and billing summary.

**Response:**
```json
{
  "current_period": {
    "start_date": "2024-01-01T00:00:00Z",
    "end_date": "2024-01-31T23:59:59Z",
    "total_sessions": 12,
    "total_minutes": 485,
    "total_cost": 495.25
  },
  "cost_breakdown": {
    "chat_sessions": 245.50,
    "voice_sessions": 125.75,
    "video_sessions": 124.00
  },
  "next_billing_date": "2024-02-01T00:00:00Z",
  "payment_method": {
    "type": "card",
    "last4": "4242",
    "expires": "12/25"
  }
}
```

### POST /api/v1/billing/payment-methods
Add payment method.

### DELETE /api/v1/billing/payment-methods/{method_id}
Remove payment method.

### POST /api/v1/billing/webhooks/lago
Handle Lago billing webhooks.

---

## Error Responses

All API endpoints return errors in the following format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    },
    "timestamp": "2024-01-01T10:00:00Z",
    "request_id": "uuid"
  }
}
```

### Common Error Codes:
- `AUTHENTICATION_REQUIRED` (401)
- `AUTHORIZATION_FAILED` (403)
- `NOT_FOUND` (404)
- `VALIDATION_ERROR` (400)
- `RATE_LIMIT_EXCEEDED` (429)
- `INTERNAL_SERVER_ERROR` (500)
- `SERVICE_UNAVAILABLE` (503)

---

## Rate Limits

- **Authentication endpoints**: 5 requests per minute
- **Chat messages**: 60 messages per minute
- **File uploads**: 10 uploads per hour
- **API calls**: 1000 requests per hour per user
- **WebSocket connections**: 5 concurrent connections per user

---

## Webhooks

The platform supports webhooks for real-time notifications:

### Webhook Events:
- `session.started`
- `session.ended`
- `message.received`
- `payment.completed`
- `payment.failed`
- `document.processed`
- `clone.published`

### Webhook Payload Example:
```json
{
  "event": "session.ended",
  "data": {
    "session_id": "uuid",
    "user_id": "uuid",
    "expert_id": "uuid",
    "duration_minutes": 35,
    "total_cost": 43.75,
    "rating": 5
  },
  "timestamp": "2024-01-01T10:00:00Z",
  "webhook_id": "uuid"
}
```