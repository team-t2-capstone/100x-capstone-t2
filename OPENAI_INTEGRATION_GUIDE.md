# CloneAI Platform - OpenAI Integration Guide

## Overview
This guide provides comprehensive instructions for integrating OpenAI APIs into the CloneAI platform, including chat completions, embeddings, and specialized AI workflows for document processing and session analysis.

## Table of Contents
1. [API Setup & Configuration](#api-setup--configuration)
2. [Chat Completions](#chat-completions)
3. [Embeddings & Vector Search](#embeddings--vector-search)
4. [Document Processing](#document-processing)
5. [Session Summarization](#session-summarization)
6. [RAG Implementation](#rag-implementation)
7. [Cost Optimization](#cost-optimization)
8. [Error Handling](#error-handling)
9. [Performance Monitoring](#performance-monitoring)

---

## API Setup & Configuration

### **Environment Variables**
```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_ORG_ID=org-your-organization-id  # Optional
OPENAI_BASE_URL=https://api.openai.com/v1  # Default

# Model Configuration
GPT_4_MODEL=gpt-4-turbo-preview
GPT_4_MINI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-large
FUNCTION_CALLING_MODEL=gpt-4-turbo

# Cost Controls
MAX_TOKENS_PER_REQUEST=4000
MAX_CONTEXT_LENGTH=8000
DAILY_COST_LIMIT=1000.00
```

### **Python Client Setup**
```python
# services/ai_service.py
import openai
from openai import AsyncOpenAI
import tiktoken
import logging
from typing import List, Dict, Optional, Any
import asyncio
from functools import wraps
import time

class AIService:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.OPENAI_API_KEY,
            organization=settings.OPENAI_ORG_ID,
            base_url=settings.OPENAI_BASE_URL
        )
        self.gpt4_model = settings.GPT_4_MODEL
        self.gpt4_mini_model = settings.GPT_4_MINI_MODEL
        self.embedding_model = settings.EMBEDDING_MODEL
        self.encoding = tiktoken.get_encoding("cl100k_base")
        
        # Cost tracking
        self.daily_costs = {}
        self.request_count = 0
        
    def count_tokens(self, text: str) -> int:
        """Count tokens in text using tiktoken"""
        return len(self.encoding.encode(text))
    
    def estimate_cost(self, input_tokens: int, output_tokens: int, model: str) -> float:
        """Estimate cost for API call"""
        costs = {
            "gpt-4-turbo-preview": {"input": 0.01, "output": 0.03},  # per 1K tokens
            "gpt-4o-mini": {"input": 0.00015, "output": 0.0006},
            "text-embedding-3-large": {"input": 0.00013, "output": 0}
        }
        
        if model in costs:
            input_cost = (input_tokens / 1000) * costs[model]["input"]
            output_cost = (output_tokens / 1000) * costs[model]["output"]
            return input_cost + output_cost
        return 0.0
```

---

## Chat Completions

### **Basic Chat Implementation**
```python
async def generate_chat_response(
    self,
    messages: List[Dict[str, str]],
    clone_personality: Dict[str, Any],
    context_chunks: List[str] = None,
    max_tokens: int = 1000,
    temperature: float = 0.7
) -> Dict[str, Any]:
    """
    Generate AI response for chat conversation
    """
    try:
        # Build system prompt with personality and context
        system_prompt = self._build_system_prompt(clone_personality, context_chunks)
        
        # Prepare messages
        chat_messages = [
            {"role": "system", "content": system_prompt}
        ]
        chat_messages.extend(messages)
        
        # Count input tokens
        input_text = "\n".join([msg["content"] for msg in chat_messages])
        input_tokens = self.count_tokens(input_text)
        
        # Check token limits
        if input_tokens > settings.MAX_CONTEXT_LENGTH:
            raise ValueError(f"Input too long: {input_tokens} tokens")
        
        # Make API call
        start_time = time.time()
        response = await self.client.chat.completions.create(
            model=self.gpt4_model,
            messages=chat_messages,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=False  # Set to True for streaming responses
        )
        
        processing_time = (time.time() - start_time) * 1000  # ms
        
        # Extract response data
        ai_message = response.choices[0].message.content
        output_tokens = response.usage.completion_tokens
        total_tokens = response.usage.total_tokens
        
        # Calculate cost
        cost = self.estimate_cost(input_tokens, output_tokens, self.gpt4_model)
        
        return {
            "response": ai_message,
            "tokens_used": total_tokens,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost": cost,
            "processing_time_ms": processing_time,
            "model": self.gpt4_model
        }
        
    except Exception as e:
        logging.error(f"Chat completion error: {str(e)}")
        raise

def _build_system_prompt(
    self,
    clone_personality: Dict[str, Any],
    context_chunks: List[str] = None
) -> str:
    """Build system prompt with personality and context"""
    
    base_prompt = f"""You are {clone_personality.get('name', 'an AI assistant')}, {clone_personality.get('description', 'a helpful AI assistant')}.

PERSONALITY TRAITS:
- Communication Style: {clone_personality.get('communication_style', 'Professional and friendly')}
- Expertise: {', '.join(clone_personality.get('expertise_areas', []))}
- Background: {clone_personality.get('bio', 'Experienced professional')}

INSTRUCTIONS:
1. Stay in character as {clone_personality.get('name')}
2. Provide helpful, accurate, and personalized responses
3. Reference your expertise when relevant
4. Be conversational and engaging
5. If you don't know something, say so honestly"""

    if context_chunks:
        context_text = "\n\n".join(context_chunks)
        base_prompt += f"""

RELEVANT KNOWLEDGE:
{context_text}

Use this knowledge to inform your responses, but don't just copy it. Integrate it naturally into your advice and explanations. Always cite sources when using specific information."""

    return base_prompt
```

### **Streaming Chat Response**
```python
async def generate_streaming_response(
    self,
    messages: List[Dict[str, str]],
    clone_personality: Dict[str, Any],
    websocket=None
) -> AsyncIterator[str]:
    """Generate streaming chat response for real-time UI"""
    
    system_prompt = self._build_system_prompt(clone_personality)
    chat_messages = [{"role": "system", "content": system_prompt}]
    chat_messages.extend(messages)
    
    try:
        stream = await self.client.chat.completions.create(
            model=self.gpt4_model,
            messages=chat_messages,
            max_tokens=1000,
            temperature=0.7,
            stream=True
        )
        
        full_response = ""
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                full_response += content
                
                # Send to WebSocket if provided
                if websocket:
                    await websocket.send_json({
                        "type": "ai_response_chunk",
                        "content": content,
                        "is_complete": False
                    })
                
                yield content
        
        # Send completion signal
        if websocket:
            await websocket.send_json({
                "type": "ai_response_chunk",
                "content": "",
                "is_complete": True,
                "full_response": full_response
            })
            
    except Exception as e:
        logging.error(f"Streaming error: {str(e)}")
        if websocket:
            await websocket.send_json({
                "type": "error",
                "message": "Failed to generate response"
            })
        raise
```

---

## Embeddings & Vector Search

### **Generate Embeddings**
```python
async def generate_embeddings(
    self,
    texts: List[str],
    batch_size: int = 100
) -> List[List[float]]:
    """Generate embeddings for text chunks"""
    
    all_embeddings = []
    
    # Process in batches to avoid rate limits
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        
        try:
            response = await self.client.embeddings.create(
                model=self.embedding_model,
                input=batch
            )
            
            batch_embeddings = [data.embedding for data in response.data]
            all_embeddings.extend(batch_embeddings)
            
            # Rate limiting
            await asyncio.sleep(0.1)  # 100ms delay between batches
            
        except Exception as e:
            logging.error(f"Embedding generation error: {str(e)}")
            # Return zero vectors for failed batches
            zero_vector = [0.0] * 1536  # text-embedding-3-large dimension
            all_embeddings.extend([zero_vector] * len(batch))
    
    return all_embeddings

async def generate_single_embedding(self, text: str) -> List[float]:
    """Generate embedding for single text"""
    try:
        response = await self.client.embeddings.create(
            model=self.embedding_model,
            input=[text]
        )
        return response.data[0].embedding
    except Exception as e:
        logging.error(f"Single embedding error: {str(e)}")
        return [0.0] * 1536
```

### **Vector Similarity Search**
```python
# In your database service
async def search_similar_chunks(
    self,
    query_embedding: List[float],
    clone_id: str,
    limit: int = 10,
    similarity_threshold: float = 0.7
) -> List[Dict[str, Any]]:
    """Search for similar knowledge chunks using vector similarity"""
    
    query = """
    SELECT 
        kc.id,
        kc.content,
        kc.metadata,
        cd.title as document_title,
        1 - (kc.embedding <=> $1::vector) as similarity_score
    FROM knowledge_chunks kc
    JOIN clone_documents cd ON kc.document_id = cd.id
    WHERE kc.clone_id = $2
    AND 1 - (kc.embedding <=> $1::vector) > $3
    ORDER BY kc.embedding <=> $1::vector
    LIMIT $4
    """
    
    results = await self.db.fetch_all(
        query,
        query_embedding,
        clone_id,
        similarity_threshold,
        limit
    )
    
    return [
        {
            "id": row["id"],
            "content": row["content"],
            "document_title": row["document_title"],
            "similarity_score": row["similarity_score"],
            "metadata": row["metadata"]
        }
        for row in results
    ]
```

---

## Document Processing

### **Text Extraction & Processing**
```python
async def process_document(
    self,
    file_content: bytes,
    file_type: str,
    clone_id: str
) -> Dict[str, Any]:
    """Process uploaded document and extract text"""
    
    try:
        # Extract text based on file type
        if file_type == "pdf":
            text = await self._extract_pdf_text(file_content)
        elif file_type == "docx":
            text = await self._extract_docx_text(file_content)
        elif file_type == "txt":
            text = file_content.decode('utf-8')
        else:
            raise ValueError(f"Unsupported file type: {file_type}")
        
        # Clean and normalize text using OpenAI
        cleaned_text = await self._clean_text_with_ai(text)
        
        # Chunk the text
        chunks = await self._create_text_chunks(cleaned_text)
        
        # Generate embeddings for chunks
        embeddings = await self.generate_embeddings([chunk["content"] for chunk in chunks])
        
        # Combine chunks with embeddings
        processed_chunks = []
        for chunk, embedding in zip(chunks, embeddings):
            processed_chunks.append({
                **chunk,
                "embedding": embedding
            })
        
        return {
            "original_text": text,
            "cleaned_text": cleaned_text,
            "chunks": processed_chunks,
            "total_chunks": len(processed_chunks),
            "total_tokens": sum(chunk["token_count"] for chunk in processed_chunks)
        }
        
    except Exception as e:
        logging.error(f"Document processing error: {str(e)}")
        raise

async def _clean_text_with_ai(self, text: str) -> str:
    """Use OpenAI to clean and normalize extracted text"""
    
    prompt = f"""Clean and normalize the following text extracted from a document. 
Fix any OCR errors, normalize formatting, and ensure readability while preserving all important information:

{text[:4000]}  # Limit to avoid token limits

Return only the cleaned text without any explanations."""

    try:
        response = await self.client.chat.completions.create(
            model=self.gpt4_mini_model,  # Use cheaper model for cleaning
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.1  # Low temperature for consistency
        )
        
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        logging.warning(f"AI text cleaning failed: {str(e)}")
        return text  # Return original text if cleaning fails

async def _create_text_chunks(
    self,
    text: str,
    chunk_size: int = 1000,
    overlap: int = 200
) -> List[Dict[str, Any]]:
    """Create overlapping text chunks for vector storage"""
    
    # Split text into sentences for better chunk boundaries
    sentences = text.split('. ')
    
    chunks = []
    current_chunk = ""
    current_tokens = 0
    chunk_index = 0
    
    for sentence in sentences:
        sentence_tokens = self.count_tokens(sentence)
        
        # If adding this sentence would exceed chunk size, start new chunk
        if current_tokens + sentence_tokens > chunk_size and current_chunk:
            chunks.append({
                "content": current_chunk.strip(),
                "chunk_index": chunk_index,
                "token_count": current_tokens,
                "start_char": len(text) - len('. '.join(sentences[chunk_index:])),
                "end_char": len(text) - len('. '.join(sentences[chunk_index:]))
            })
            
            # Start new chunk with overlap
            overlap_text = '. '.join(current_chunk.split('. ')[-overlap//50:])  # Rough overlap
            current_chunk = overlap_text + '. ' + sentence
            current_tokens = self.count_tokens(current_chunk)
            chunk_index += 1
        else:
            current_chunk += '. ' + sentence if current_chunk else sentence
            current_tokens += sentence_tokens
    
    # Add final chunk
    if current_chunk:
        chunks.append({
            "content": current_chunk.strip(),
            "chunk_index": chunk_index,
            "token_count": current_tokens
        })
    
    return chunks
```

---

## Session Summarization

### **Generate Session Summary**
```python
async def generate_session_summary(
    self,
    messages: List[Dict[str, str]],
    expert_name: str,
    summary_type: str = "detailed"
) -> Dict[str, Any]:
    """Generate comprehensive session summary using OpenAI"""
    
    # Build conversation context
    conversation = "\n".join([
        f"{msg['sender_type'].upper()}: {msg['content']}"
        for msg in messages
    ])
    
    summary_prompts = {
        "brief": f"""Provide a brief 2-3 sentence summary of this conversation with {expert_name}:

{conversation}

Focus on the main topics discussed and key outcomes.""",
        
        "detailed": f"""Analyze this conversation with {expert_name} and provide a comprehensive summary including:

1. **Main Topics Discussed**: Key subjects covered
2. **Key Insights**: Important points and revelations
3. **Action Items**: Specific tasks or recommendations given
4. **Progress Made**: Any goals achieved or progress noted
5. **Next Steps**: Recommended follow-up actions
6. **Overall Assessment**: Success of the session

Conversation:
{conversation}

Provide a structured response in JSON format.""",
        
        "action_items": f"""Extract specific action items and recommendations from this conversation with {expert_name}:

{conversation}

Return a JSON array of action items with priority levels and estimated effort."""
    }
    
    try:
        response = await self.client.chat.completions.create(
            model=self.gpt4_model,
            messages=[{
                "role": "user",
                "content": summary_prompts.get(summary_type, summary_prompts["detailed"])
            }],
            max_tokens=1500,
            temperature=0.3  # Lower temperature for consistent summaries
        )
        
        summary_text = response.choices[0].message.content
        
        # Try to parse JSON for detailed summaries
        if summary_type == "detailed":
            try:
                import json
                summary_data = json.loads(summary_text)
                return {
                    "summary_type": summary_type,
                    "summary_text": summary_text,
                    "structured_data": summary_data,
                    "tokens_used": response.usage.total_tokens,
                    "cost": self.estimate_cost(
                        response.usage.prompt_tokens,
                        response.usage.completion_tokens,
                        self.gpt4_model
                    )
                }
            except json.JSONDecodeError:
                pass
        
        return {
            "summary_type": summary_type,
            "summary_text": summary_text,
            "tokens_used": response.usage.total_tokens,
            "cost": self.estimate_cost(
                response.usage.prompt_tokens,
                response.usage.completion_tokens,
                self.gpt4_model
            )
        }
        
    except Exception as e:
        logging.error(f"Session summary error: {str(e)}")
        raise

async def extract_conversation_insights(
    self,
    messages: List[Dict[str, str]],
    user_id: str,
    expert_name: str
) -> Dict[str, Any]:
    """Extract insights for long-term memory and personalization"""
    
    conversation = "\n".join([
        f"{msg['sender_type'].upper()}: {msg['content']}"
        for msg in messages
    ])
    
    insight_prompt = f"""Analyze this conversation with {expert_name} and extract insights for personalization:

{conversation}

Extract and return as JSON:
1. **user_preferences**: Communication style, preferred examples, learning pace
2. **user_goals**: Short and long-term goals mentioned
3. **progress_indicators**: Signs of progress or setbacks
4. **context_to_remember**: Important personal context for future sessions
5. **expertise_interests**: Areas where user shows particular interest
6. **follow_up_topics**: Topics that should be revisited

Focus on information that would help personalize future conversations."""

    try:
        response = await self.client.chat.completions.create(
            model=self.gpt4_model,
            messages=[{"role": "user", "content": insight_prompt}],
            max_tokens=1000,
            temperature=0.2
        )
        
        insights_text = response.choices[0].message.content
        
        try:
            import json
            insights_data = json.loads(insights_text)
            return {
                "insights": insights_data,
                "raw_text": insights_text,
                "confidence_score": 0.8,  # Could be determined by model
                "tokens_used": response.usage.total_tokens
            }
        except json.JSONDecodeError:
            return {
                "insights": {},
                "raw_text": insights_text,
                "confidence_score": 0.5,
                "tokens_used": response.usage.total_tokens
            }
            
    except Exception as e:
        logging.error(f"Insight extraction error: {str(e)}")
        return {"insights": {}, "error": str(e)}
```

---

## RAG Implementation

### **Complete RAG Pipeline**
```python
class RAGService:
    def __init__(self, ai_service: AIService, db_service):
        self.ai_service = ai_service
        self.db_service = db_service
    
    async def generate_rag_response(
        self,
        query: str,
        clone_id: str,
        conversation_history: List[Dict[str, str]] = None,
        max_context_chunks: int = 5
    ) -> Dict[str, Any]:
        """Generate response using RAG pipeline"""
        
        try:
            # Step 1: Generate query embedding
            query_embedding = await self.ai_service.generate_single_embedding(query)
            
            # Step 2: Search for relevant knowledge chunks
            relevant_chunks = await self.db_service.search_similar_chunks(
                query_embedding=query_embedding,
                clone_id=clone_id,
                limit=max_context_chunks,
                similarity_threshold=0.7
            )
            
            # Step 3: Get clone personality
            clone_info = await self.db_service.get_clone_info(clone_id)
            
            # Step 4: Build context from retrieved chunks
            context_texts = []
            sources = []
            
            for chunk in relevant_chunks:
                context_texts.append(
                    f"From '{chunk['document_title']}': {chunk['content']}"
                )
                sources.append({
                    "title": chunk["document_title"],
                    "similarity_score": chunk["similarity_score"],
                    "chunk_id": chunk["id"]
                })
            
            # Step 5: Prepare conversation messages
            messages = conversation_history or []
            messages.append({"role": "user", "content": query})
            
            # Step 6: Generate response with context
            response_data = await self.ai_service.generate_chat_response(
                messages=messages,
                clone_personality=clone_info,
                context_chunks=context_texts,
                max_tokens=1000,
                temperature=0.7
            )
            
            # Step 7: Add RAG-specific metadata
            response_data.update({
                "sources": sources,
                "context_chunks_used": len(relevant_chunks),
                "rag_enabled": True,
                "retrieval_quality": self._assess_retrieval_quality(relevant_chunks)
            })
            
            return response_data
            
        except Exception as e:
            logging.error(f"RAG pipeline error: {str(e)}")
            # Fallback to non-RAG response
            return await self.ai_service.generate_chat_response(
                messages=[{"role": "user", "content": query}],
                clone_personality=clone_info or {},
                max_tokens=1000
            )
    
    def _assess_retrieval_quality(self, chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Assess the quality of retrieved chunks"""
        if not chunks:
            return {"score": 0.0, "status": "no_context"}
        
        avg_similarity = sum(chunk["similarity_score"] for chunk in chunks) / len(chunks)
        
        if avg_similarity > 0.8:
            status = "excellent"
        elif avg_similarity > 0.7:
            status = "good"
        elif avg_similarity > 0.6:
            status = "fair"
        else:
            status = "poor"
        
        return {
            "score": avg_similarity,
            "status": status,
            "chunk_count": len(chunks),
            "diversity": len(set(chunk["document_title"] for chunk in chunks))
        }

async def query_expansion(self, original_query: str) -> List[str]:
    """Expand user query for better retrieval"""
    
    expansion_prompt = f"""Given this user query: "{original_query}"

Generate 2-3 alternative phrasings that would help find relevant information. 
Consider synonyms, related concepts, and different ways to express the same need.

Return only the alternative queries, one per line."""

    try:
        response = await self.ai_service.client.chat.completions.create(
            model=self.ai_service.gpt4_mini_model,
            messages=[{"role": "user", "content": expansion_prompt}],
            max_tokens=200,
            temperature=0.7
        )
        
        expanded_queries = response.choices[0].message.content.strip().split('\n')
        return [original_query] + [q.strip() for q in expanded_queries if q.strip()]
        
    except Exception as e:
        logging.warning(f"Query expansion failed: {str(e)}")
        return [original_query]
```

---

## Cost Optimization

### **Cost Tracking & Management**
```python
class CostManager:
    def __init__(self):
        self.daily_costs = {}
        self.user_costs = {}
        self.model_costs = {}
    
    async def track_api_call(
        self,
        user_id: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost: float
    ):
        """Track API call costs"""
        
        today = datetime.now().date()
        
        # Daily cost tracking
        if today not in self.daily_costs:
            self.daily_costs[today] = 0.0
        self.daily_costs[today] += cost
        
        # User cost tracking
        if user_id not in self.user_costs:
            self.user_costs[user_id] = 0.0
        self.user_costs[user_id] += cost
        
        # Model cost tracking
        if model not in self.model_costs:
            self.model_costs[model] = {"calls": 0, "cost": 0.0, "tokens": 0}
        self.model_costs[model]["calls"] += 1
        self.model_costs[model]["cost"] += cost
        self.model_costs[model]["tokens"] += input_tokens + output_tokens
        
        # Check limits
        await self._check_cost_limits(user_id, today)
    
    async def _check_cost_limits(self, user_id: str, date: datetime.date):
        """Check if cost limits are exceeded"""
        
        daily_limit = float(settings.DAILY_COST_LIMIT)
        user_daily_limit = 50.0  # Per user daily limit
        
        # Check daily limit
        if self.daily_costs.get(date, 0) > daily_limit:
            logging.critical(f"Daily cost limit exceeded: ${self.daily_costs[date]}")
            # Send alert, disable API calls, etc.
        
        # Check user limit
        user_daily_cost = await self._get_user_daily_cost(user_id, date)
        if user_daily_cost > user_daily_limit:
            logging.warning(f"User {user_id} daily limit exceeded: ${user_daily_cost}")
            # Implement user-specific rate limiting

async def optimize_token_usage(
    self,
    messages: List[Dict[str, str]],
    max_context_length: int = 8000
) -> List[Dict[str, str]]:
    """Optimize message history to fit within token limits"""
    
    # Always keep system message
    system_message = messages[0] if messages and messages[0]["role"] == "system" else None
    conversation_messages = messages[1:] if system_message else messages
    
    # Keep the most recent messages that fit within limits
    total_tokens = 0
    if system_message:
        total_tokens += self.ai_service.count_tokens(system_message["content"])
    
    optimized_messages = []
    
    # Add messages from most recent, going backwards
    for message in reversed(conversation_messages):
        message_tokens = self.ai_service.count_tokens(message["content"])
        
        if total_tokens + message_tokens <= max_context_length:
            optimized_messages.insert(0, message)
            total_tokens += message_tokens
        else:
            break
    
    # Reconstruct with system message
    final_messages = []
    if system_message:
        final_messages.append(system_message)
    final_messages.extend(optimized_messages)
    
    return final_messages
```

### **Model Selection Strategy**
```python
def select_optimal_model(
    self,
    task_type: str,
    complexity: str = "medium",
    context_length: int = 0
) -> str:
    """Select the most cost-effective model for the task"""
    
    model_selection = {
        "chat": {
            "simple": self.gpt4_mini_model,      # Basic conversation
            "medium": self.gpt4_model,           # Standard chat with context
            "complex": self.gpt4_model           # Complex reasoning
        },
        "summarization": {
            "simple": self.gpt4_mini_model,      # Brief summaries
            "medium": self.gpt4_mini_model,      # Standard summaries
            "complex": self.gpt4_model           # Detailed analysis
        },
        "document_processing": {
            "simple": self.gpt4_mini_model,      # Text cleaning
            "medium": self.gpt4_model,           # Content extraction
            "complex": self.gpt4_model           # Complex analysis
        },
        "embeddings": {
            "simple": self.embedding_model,
            "medium": self.embedding_model,
            "complex": self.embedding_model
        }
    }
    
    # Consider context length for model selection
    if context_length > 16000:
        return self.gpt4_model  # Use GPT-4 for very long contexts
    
    return model_selection.get(task_type, {}).get(complexity, self.gpt4_model)
```

---

## Error Handling

### **Robust Error Handling**
```python
from functools import wraps
import asyncio
from typing import Callable, Any
import random

def retry_with_exponential_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0
):
    """Decorator for retrying OpenAI API calls with exponential backoff"""
    
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                    
                except openai.RateLimitError as e:
                    last_exception = e
                    if attempt == max_retries:
                        break
                    
                    # Exponential backoff with jitter
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    jitter = random.uniform(0, 0.1) * delay
                    
                    logging.warning(f"Rate limit hit, retrying in {delay + jitter:.2f}s")
                    await asyncio.sleep(delay + jitter)
                    
                except openai.APIConnectionError as e:
                    last_exception = e
                    if attempt == max_retries:
                        break
                    
                    delay = base_delay * (2 ** attempt)
                    logging.warning(f"API connection error, retrying in {delay}s")
                    await asyncio.sleep(delay)
                    
                except openai.APIError as e:
                    # Don't retry on API errors (invalid requests, etc.)
                    logging.error(f"OpenAI API error: {str(e)}")
                    raise
                    
                except Exception as e:
                    # Don't retry on unexpected errors
                    logging.error(f"Unexpected error in OpenAI call: {str(e)}")
                    raise
            
            # If we get here, all retries failed
            logging.error(f"All {max_retries} retries failed for OpenAI API call")
            raise last_exception
            
        return wrapper
    return decorator

class OpenAIErrorHandler:
    @staticmethod
    def handle_api_error(error: Exception) -> Dict[str, Any]:
        """Handle OpenAI API errors and return user-friendly responses"""
        
        if isinstance(error, openai.RateLimitError):
            return {
                "error_type": "rate_limit",
                "message": "The AI service is currently busy. Please try again in a moment.",
                "retry_after": 60,
                "user_message": "Too many requests. Please wait a moment before trying again."
            }
            
        elif isinstance(error, openai.APIConnectionError):
            return {
                "error_type": "connection",
                "message": "Unable to connect to AI service. Please check your connection.",
                "retry_after": 30,
                "user_message": "Connection error. Please try again."
            }
            
        elif isinstance(error, openai.AuthenticationError):
            return {
                "error_type": "authentication",
                "message": "AI service authentication failed.",
                "retry_after": None,
                "user_message": "Service temporarily unavailable. Please try again later."
            }
            
        elif isinstance(error, openai.InvalidRequestError):
            return {
                "error_type": "invalid_request",
                "message": "Invalid request to AI service.",
                "retry_after": None,
                "user_message": "Your request couldn't be processed. Please try rephrasing."
            }
            
        else:
            return {
                "error_type": "unknown",
                "message": f"Unexpected error: {str(error)}",
                "retry_after": None,
                "user_message": "Something went wrong. Please try again."
            }
```

---

## Performance Monitoring

### **Performance Metrics Collection**
```python
class OpenAIMetrics:
    def __init__(self):
        self.metrics = {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "total_tokens": 0,
            "total_cost": 0.0,
            "average_response_time": 0.0,
            "requests_by_model": {},
            "errors_by_type": {}
        }
    
    async def record_request(
        self,
        model: str,
        success: bool,
        tokens_used: int,
        cost: float,
        response_time_ms: float,
        error_type: str = None
    ):
        """Record metrics for an OpenAI API request"""
        
        self.metrics["total_requests"] += 1
        
        if success:
            self.metrics["successful_requests"] += 1
            self.metrics["total_tokens"] += tokens_used
            self.metrics["total_cost"] += cost
            
            # Update average response time
            current_avg = self.metrics["average_response_time"]
            self.metrics["average_response_time"] = (
                (current_avg * (self.metrics["successful_requests"] - 1) + response_time_ms)
                / self.metrics["successful_requests"]
            )
        else:
            self.metrics["failed_requests"] += 1
            if error_type:
                self.metrics["errors_by_type"][error_type] = (
                    self.metrics["errors_by_type"].get(error_type, 0) + 1
                )
        
        # Track by model
        if model not in self.metrics["requests_by_model"]:
            self.metrics["requests_by_model"][model] = {
                "requests": 0,
                "successful": 0,
                "failed": 0,
                "tokens": 0,
                "cost": 0.0
            }
        
        model_metrics = self.metrics["requests_by_model"][model]
        model_metrics["requests"] += 1
        
        if success:
            model_metrics["successful"] += 1
            model_metrics["tokens"] += tokens_used
            model_metrics["cost"] += cost
        else:
            model_metrics["failed"] += 1
    
    def get_performance_report(self) -> Dict[str, Any]:
        """Generate performance report"""
        
        total_requests = self.metrics["total_requests"]
        if total_requests == 0:
            return {"message": "No requests recorded"}
        
        success_rate = (self.metrics["successful_requests"] / total_requests) * 100
        
        return {
            "total_requests": total_requests,
            "success_rate": f"{success_rate:.2f}%",
            "total_tokens_used": self.metrics["total_tokens"],
            "total_cost": f"${self.metrics['total_cost']:.4f}",
            "average_response_time_ms": f"{self.metrics['average_response_time']:.2f}",
            "requests_by_model": self.metrics["requests_by_model"],
            "error_breakdown": self.metrics["errors_by_type"],
            "cost_per_token": (
                self.metrics["total_cost"] / self.metrics["total_tokens"]
                if self.metrics["total_tokens"] > 0 else 0
            )
        }

# Integration with main AI service
@retry_with_exponential_backoff(max_retries=3)
async def monitored_api_call(self, func, *args, **kwargs):
    """Wrapper for monitoring API calls"""
    
    start_time = time.time()
    success = False
    tokens_used = 0
    cost = 0.0
    error_type = None
    
    try:
        result = await func(*args, **kwargs)
        success = True
        tokens_used = result.get("tokens_used", 0)
        cost = result.get("cost", 0.0)
        return result
        
    except Exception as e:
        error_info = OpenAIErrorHandler.handle_api_error(e)
        error_type = error_info["error_type"]
        raise
        
    finally:
        response_time = (time.time() - start_time) * 1000
        model = kwargs.get("model", "unknown")
        
        await self.metrics.record_request(
            model=model,
            success=success,
            tokens_used=tokens_used,
            cost=cost,
            response_time_ms=response_time,
            error_type=error_type
        )
```

---

## Usage Examples

### **Complete Integration Example**
```python
# Example usage in your API endpoint
from fastapi import APIRouter, Depends, HTTPException
from services.ai_service import AIService
from services.rag_service import RAGService

router = APIRouter()

@router.post("/chat/message")
async def send_chat_message(
    session_id: str,
    message: str,
    user_id: str = Depends(get_current_user)
):
    try:
        # Get session info
        session = await db.get_session(session_id)
        if not session or session.user_id != user_id:
            raise HTTPException(status_code=404, detail="Session not found")
        
        # Initialize services
        ai_service = AIService()
        rag_service = RAGService(ai_service, db)
        
        # Get conversation history
        conversation_history = await db.get_session_messages(session_id)
        
        # Generate RAG response
        response_data = await rag_service.generate_rag_response(
            query=message,
            clone_id=session.clone_id,
            conversation_history=conversation_history,
            max_context_chunks=5
        )
        
        # Save message and response to database
        await db.save_message(session_id, "user", message)
        await db.save_message(
            session_id, 
            "ai", 
            response_data["response"],
            metadata={
                "sources": response_data.get("sources", []),
                "tokens_used": response_data["tokens_used"],
                "cost": response_data["cost"]
            }
        )
        
        # Update session cost
        await db.update_session_cost(session_id, response_data["cost"])
        
        return {
            "response": response_data["response"],
            "sources": response_data.get("sources", []),
            "session_cost": session.total_cost + response_data["cost"],
            "processing_time_ms": response_data.get("processing_time_ms", 0)
        }
        
    except Exception as e:
        logging.error(f"Chat message error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate response")
```

This comprehensive OpenAI integration guide provides all the necessary components for implementing AI features in the CloneAI platform, with proper error handling, cost optimization, and performance monitoring.