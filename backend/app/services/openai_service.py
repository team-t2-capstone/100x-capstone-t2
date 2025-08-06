"""
OpenAI Service
Handles all OpenAI API interactions including chat completions and embeddings
"""
import asyncio
from typing import List, Dict, Any, Optional, AsyncGenerator, Union
from datetime import datetime, timedelta
import logging
import json
import time

import openai
from openai import AsyncOpenAI
import structlog

from app.config import settings

logger = structlog.get_logger()

class OpenAIService:
    def __init__(self):
        self.client: Optional[AsyncOpenAI] = None
        self.rate_limiter = {}  # Simple rate limiting storage
        self.usage_tracker = {
            'total_tokens': 0,
            'total_requests': 0,
            'daily_cost': 0.0,
            'last_reset': datetime.utcnow().date()
        }
        self.initialize_client()

    def initialize_client(self):
        """Initialize OpenAI client with API key from settings"""
        try:
            if not settings.OPENAI_API_KEY or settings.OPENAI_API_KEY.startswith('sk-['):
                logger.warning("OpenAI API key not configured properly")
                return
            
            self.client = AsyncOpenAI(
                api_key=settings.OPENAI_API_KEY,
                organization=settings.OPENAI_ORG_ID if hasattr(settings, 'OPENAI_ORG_ID') else None
            )
            logger.info("OpenAI client initialized successfully")
            
        except Exception as e:
            logger.error("Failed to initialize OpenAI client", error=str(e))
            self.client = None

    def is_available(self) -> bool:
        """Check if OpenAI service is available"""
        return self.client is not None

    def reset_daily_usage(self):
        """Reset daily usage counters if needed"""
        current_date = datetime.utcnow().date()
        if current_date > self.usage_tracker['last_reset']:
            self.usage_tracker.update({
                'daily_cost': 0.0,
                'last_reset': current_date
            })

    def check_daily_limit(self, estimated_cost: float = 0.05) -> bool:
        """Check if request would exceed daily cost limit"""
        self.reset_daily_usage()
        
        if hasattr(settings, 'DAILY_COST_LIMIT'):
            if self.usage_tracker['daily_cost'] + estimated_cost > settings.DAILY_COST_LIMIT:
                logger.warning("Daily cost limit would be exceeded", 
                             current_cost=self.usage_tracker['daily_cost'],
                             limit=settings.DAILY_COST_LIMIT)
                return False
        return True

    def update_usage_tracking(self, usage_data: Dict[str, Any], model: str):
        """Update usage tracking with token counts and estimated costs"""
        try:
            if not usage_data:
                return

            total_tokens = usage_data.get('total_tokens', 0)
            prompt_tokens = usage_data.get('prompt_tokens', 0)
            completion_tokens = usage_data.get('completion_tokens', 0)

            # Rough cost estimation (prices as of 2024)
            cost_per_1k_tokens = {
                'gpt-4': {'input': 0.03, 'output': 0.06},
                'gpt-4-turbo': {'input': 0.01, 'output': 0.03},
                'gpt-3.5-turbo': {'input': 0.002, 'output': 0.002},
                'text-embedding-3-large': {'input': 0.00013, 'output': 0},
                'text-embedding-3-small': {'input': 0.00002, 'output': 0},
            }

            model_costs = cost_per_1k_tokens.get(model, {'input': 0.01, 'output': 0.03})
            estimated_cost = (
                (prompt_tokens / 1000) * model_costs['input'] +
                (completion_tokens / 1000) * model_costs['output']
            )

            # Update tracking
            self.usage_tracker['total_tokens'] += total_tokens
            self.usage_tracker['total_requests'] += 1
            self.usage_tracker['daily_cost'] += estimated_cost

            logger.info("Usage updated", 
                       tokens=total_tokens, 
                       cost=estimated_cost,
                       daily_total=self.usage_tracker['daily_cost'])

        except Exception as e:
            logger.error("Failed to update usage tracking", error=str(e))

    async def create_chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        stream: bool = False,
        user_id: Optional[str] = None
    ) -> Union[Dict[str, Any], AsyncGenerator[Dict[str, Any], None]]:
        """
        Create a chat completion using OpenAI API
        
        Args:
            messages: List of message dicts with 'role' and 'content'
            model: OpenAI model to use
            temperature: Response randomness (0-2)
            max_tokens: Maximum tokens to generate
            stream: Whether to stream the response
            user_id: User ID for tracking
            
        Returns:
            Chat completion response or async generator for streaming
        """
        if not self.is_available():
            raise Exception("OpenAI service is not available")

        # Use default model if not specified
        if not model:
            model = getattr(settings, 'GPT_4_MINI_MODEL', 'gpt-4o-mini')

        # Check daily cost limit
        if not self.check_daily_limit():
            raise Exception("Daily cost limit exceeded")

        # Apply max token limits
        if not max_tokens:
            max_tokens = getattr(settings, 'MAX_TOKENS_PER_REQUEST', 2000)

        try:
            logger.info("Creating chat completion", 
                       model=model, 
                       message_count=len(messages),
                       user_id=user_id)

            if stream:
                return self._create_streaming_completion(
                    messages, model, temperature, max_tokens, user_id
                )
            else:
                return await self._create_standard_completion(
                    messages, model, temperature, max_tokens, user_id
                )

        except openai.RateLimitError as e:
            logger.error("OpenAI rate limit exceeded", error=str(e))
            raise Exception("Rate limit exceeded. Please try again later.")
        
        except openai.AuthenticationError as e:
            logger.error("OpenAI authentication failed", error=str(e))
            raise Exception("Authentication failed with OpenAI")
        
        except openai.APIError as e:
            logger.error("OpenAI API error", error=str(e))
            raise Exception(f"OpenAI API error: {str(e)}")
        
        except Exception as e:
            logger.error("Unexpected error in chat completion", error=str(e))
            raise Exception("Failed to generate response")

    async def _create_standard_completion(
        self, 
        messages: List[Dict[str, str]], 
        model: str, 
        temperature: float, 
        max_tokens: int,
        user_id: Optional[str]
    ) -> Dict[str, Any]:
        """Create a standard (non-streaming) chat completion"""
        
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            user=user_id
        )

        # Update usage tracking
        if response.usage:
            self.update_usage_tracking(response.usage.model_dump(), model)

        return {
            'id': response.id,
            'object': response.object,
            'created': response.created,
            'model': response.model,
            'choices': [
                {
                    'index': choice.index,
                    'message': {
                        'role': choice.message.role,
                        'content': choice.message.content
                    },
                    'finish_reason': choice.finish_reason
                }
                for choice in response.choices
            ],
            'usage': response.usage.model_dump() if response.usage else {}
        }

    async def _create_streaming_completion(
        self, 
        messages: List[Dict[str, str]], 
        model: str, 
        temperature: float, 
        max_tokens: int,
        user_id: Optional[str]
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Create a streaming chat completion"""
        
        stream = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            user=user_id,
            stream=True
        )

        async for chunk in stream:
            yield {
                'id': chunk.id,
                'object': chunk.object,
                'created': chunk.created,
                'model': chunk.model,
                'choices': [
                    {
                        'index': choice.index,
                        'delta': {
                            'role': choice.delta.role if choice.delta.role else None,
                            'content': choice.delta.content if choice.delta.content else ''
                        },
                        'finish_reason': choice.finish_reason
                    }
                    for choice in chunk.choices
                ]
            }

    async def create_embeddings(
        self,
        texts: Union[str, List[str]],
        model: str = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create embeddings for text(s)
        
        Args:
            texts: Single text string or list of texts
            model: Embedding model to use
            user_id: User ID for tracking
            
        Returns:
            Embeddings response with vectors
        """
        if not self.is_available():
            raise Exception("OpenAI service is not available")

        if not model:
            model = getattr(settings, 'EMBEDDING_MODEL', 'text-embedding-3-small')

        # Ensure texts is a list
        if isinstance(texts, str):
            texts = [texts]

        # Check daily cost limit
        if not self.check_daily_limit(0.01):  # Small estimated cost for embeddings
            raise Exception("Daily cost limit exceeded")

        try:
            logger.info("Creating embeddings", 
                       model=model, 
                       text_count=len(texts),
                       user_id=user_id)

            response = await self.client.embeddings.create(
                model=model,
                input=texts,
                user=user_id
            )

            # Update usage tracking
            if response.usage:
                self.update_usage_tracking(response.usage.model_dump(), model)

            return {
                'object': response.object,
                'model': response.model,
                'data': [
                    {
                        'object': item.object,
                        'index': item.index,
                        'embedding': item.embedding
                    }
                    for item in response.data
                ],
                'usage': response.usage.model_dump() if response.usage else {}
            }

        except Exception as e:
            logger.error("Failed to create embeddings", error=str(e))
            raise Exception("Failed to generate embeddings")

    async def health_check(self) -> Dict[str, Any]:
        """Check OpenAI service health and return status"""
        status = {
            'service': 'openai',
            'available': self.is_available(),
            'api_key_configured': bool(settings.OPENAI_API_KEY and not settings.OPENAI_API_KEY.startswith('sk-[')),
            'usage': self.usage_tracker.copy()
        }

        if self.is_available():
            try:
                # Test with a simple completion
                test_response = await self.client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[{"role": "user", "content": "Hello"}],
                    max_tokens=5
                )
                status['test_successful'] = True
                status['test_model'] = test_response.model
            except Exception as e:
                status['test_successful'] = False
                status['test_error'] = str(e)
        
        return status

# Global OpenAI service instance
openai_service = OpenAIService()