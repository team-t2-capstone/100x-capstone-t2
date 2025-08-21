"""
Voice Synthesis Service for AI Clones
Handles text-to-speech conversion using various TTS providers
"""
import asyncio
import logging
import hashlib
from typing import Dict, Any, Optional, BinaryIO
from pathlib import Path
import tempfile
import os

import structlog
from openai import AsyncOpenAI

# Load environment variables if dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # dotenv not available, environment variables should be set by the system
    pass

logger = structlog.get_logger()

class VoiceSynthesisService:
    """
    Voice synthesis service that converts AI clone text responses to speech
    Supports multiple TTS providers and voice customization
    """
    
    def __init__(self):
        self.openai_client = None
        
        # Voice profiles for different clone types
        self.voice_profiles = {
            "default": {
                "provider": "openai",
                "voice": "alloy",
                "model": "tts-1",
                "speed": 1.0
            },
            "medical": {
                "provider": "openai", 
                "voice": "echo",  # More professional tone
                "model": "tts-1-hd",
                "speed": 0.9
            },
            "business": {
                "provider": "openai",
                "voice": "fable",  # Confident and clear
                "model": "tts-1-hd", 
                "speed": 1.0
            },
            "education": {
                "provider": "openai",
                "voice": "nova",  # Friendly and engaging
                "model": "tts-1",
                "speed": 1.0
            },
            "coaching": {
                "provider": "openai",
                "voice": "shimmer",  # Warm and supportive
                "model": "tts-1-hd",
                "speed": 0.95
            },
            "finance": {
                "provider": "openai", 
                "voice": "onyx",  # Authoritative
                "model": "tts-1-hd",
                "speed": 1.0
            },
            "legal": {
                "provider": "openai",
                "voice": "echo",  # Professional and clear
                "model": "tts-1-hd", 
                "speed": 0.9
            }
        }
        
        # Cache for generated audio files (in production, use Redis or cloud storage)
        self.audio_cache: Dict[str, str] = {}
        
    def _ensure_client(self):
        """Lazy initialization of OpenAI client"""
        if self.openai_client is None:
            api_key = os.getenv("OPENAI_API_KEY")
            if not api_key:
                logger.warning("OPENAI_API_KEY not set, voice synthesis will be disabled")
                return False
            self.openai_client = AsyncOpenAI(api_key=api_key)
        return True
        
    async def synthesize_speech(
        self,
        text: str,
        clone_id: str,
        clone_category: str = "default",
        voice_settings: Optional[Dict[str, Any]] = None
    ) -> bytes:
        """
        Convert text to speech for an AI clone
        
        Args:
            text: The text to convert to speech
            clone_id: ID of the AI clone
            clone_category: Category of the clone (affects voice selection)
            voice_settings: Custom voice settings to override defaults
            
        Returns:
            Audio data as bytes (MP3 format)
        """
        try:
            # Check text length limit for voice generation
            if len(text) > 500:
                logger.warning(f"Text too long for voice generation: {len(text)} characters", clone_id=clone_id)
                raise ValueError("Cannot generate audio for longer responses")
                
            if not self._ensure_client():
                # Return empty audio if no API key is available
                return b''
            # Generate cache key
            cache_key = self._generate_cache_key(text, clone_id, clone_category, voice_settings)
            
            # Check cache first
            if cache_key in self.audio_cache:
                logger.debug("Using cached audio", cache_key=cache_key[:16])
                return await self._load_cached_audio(cache_key)
            
            # Get voice profile for clone category
            voice_profile = self.voice_profiles.get(clone_category, self.voice_profiles["default"])
            
            # Apply custom voice settings if provided
            if voice_settings:
                voice_profile = {**voice_profile, **voice_settings}
            
            # Generate speech based on provider
            if voice_profile["provider"] == "openai":
                audio_data = await self._synthesize_openai(text, voice_profile)
            else:
                raise ValueError(f"Unsupported TTS provider: {voice_profile['provider']}")
            
            # Cache the generated audio
            await self._cache_audio(cache_key, audio_data)
            
            logger.info("Speech synthesized successfully", 
                       text_length=len(text),
                       clone_category=clone_category,
                       voice=voice_profile.get("voice"))
            
            return audio_data
            
        except Exception as e:
            logger.error("Speech synthesis failed", 
                        error=str(e),
                        clone_id=clone_id, 
                        text_length=len(text))
            raise

    async def _synthesize_openai(self, text: str, voice_profile: Dict[str, Any]) -> bytes:
        """Synthesize speech using OpenAI TTS"""
        try:
            if not self._ensure_client():
                return b''
            
            response = await self.openai_client.audio.speech.create(
                model=voice_profile.get("model", "tts-1"),
                voice=voice_profile.get("voice", "alloy"),
                input=text,
                speed=voice_profile.get("speed", 1.0),
                response_format="mp3"
            )
            
            return response.content
            
        except Exception as e:
            logger.error("OpenAI TTS synthesis failed", error=str(e))
            raise

    def _generate_cache_key(
        self,
        text: str,
        clone_id: str, 
        clone_category: str,
        voice_settings: Optional[Dict[str, Any]]
    ) -> str:
        """Generate a unique cache key for the audio"""
        content = f"{text}:{clone_id}:{clone_category}:{voice_settings or {}}"
        return hashlib.sha256(content.encode()).hexdigest()

    async def _cache_audio(self, cache_key: str, audio_data: bytes) -> None:
        """Cache generated audio data"""
        try:
            # In production, save to cloud storage (S3, GCS) or Redis
            # For now, save to temporary directory
            temp_dir = Path(tempfile.gettempdir()) / "cloneai_audio_cache"
            temp_dir.mkdir(exist_ok=True)
            
            cache_file = temp_dir / f"{cache_key}.mp3"
            
            with open(cache_file, "wb") as f:
                f.write(audio_data)
            
            self.audio_cache[cache_key] = str(cache_file)
            
            logger.debug("Audio cached", cache_key=cache_key[:16], file_path=str(cache_file))
            
        except Exception as e:
            logger.warning("Failed to cache audio", error=str(e), cache_key=cache_key[:16])

    async def _load_cached_audio(self, cache_key: str) -> bytes:
        """Load cached audio data"""
        try:
            cache_file = self.audio_cache.get(cache_key)
            if not cache_file or not os.path.exists(cache_file):
                raise FileNotFoundError("Cached audio file not found")
            
            with open(cache_file, "rb") as f:
                return f.read()
                
        except Exception as e:
            logger.warning("Failed to load cached audio", error=str(e), cache_key=cache_key[:16])
            # Remove invalid cache entry
            if cache_key in self.audio_cache:
                del self.audio_cache[cache_key]
            raise

    async def get_available_voices(self, provider: str = "openai") -> Dict[str, Any]:
        """Get available voices for a TTS provider"""
        if provider == "openai":
            return {
                "voices": [
                    {"id": "alloy", "name": "Alloy", "description": "Balanced and versatile"},
                    {"id": "echo", "name": "Echo", "description": "Professional and clear"},
                    {"id": "fable", "name": "Fable", "description": "Confident and engaging"},
                    {"id": "onyx", "name": "Onyx", "description": "Deep and authoritative"},
                    {"id": "nova", "name": "Nova", "description": "Friendly and warm"},
                    {"id": "shimmer", "name": "Shimmer", "description": "Gentle and supportive"}
                ],
                "models": ["tts-1", "tts-1-hd"],
                "formats": ["mp3", "opus", "aac", "flac"],
                "speed_range": [0.25, 4.0]
            }
        else:
            return {"error": f"Provider {provider} not supported"}

    async def customize_clone_voice(
        self, 
        clone_id: str,
        voice_settings: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Customize voice settings for a specific clone
        
        Args:
            clone_id: The clone to customize
            voice_settings: Voice customization options
            
        Returns:
            Updated voice profile
        """
        try:
            # Validate voice settings
            valid_voices = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]
            valid_models = ["tts-1", "tts-1-hd"]
            
            if voice_settings.get("voice") not in valid_voices:
                raise ValueError(f"Invalid voice. Must be one of: {valid_voices}")
            
            if voice_settings.get("model") not in valid_models:
                raise ValueError(f"Invalid model. Must be one of: {valid_models}")
            
            speed = voice_settings.get("speed", 1.0)
            if not 0.25 <= speed <= 4.0:
                raise ValueError("Speed must be between 0.25 and 4.0")
            
            # In production, save to database
            # For now, just return the validated settings
            customized_profile = {
                "clone_id": clone_id,
                "voice": voice_settings.get("voice", "alloy"),
                "model": voice_settings.get("model", "tts-1"),
                "speed": speed,
                "provider": "openai",
                "updated_at": asyncio.get_event_loop().time()
            }
            
            logger.info("Clone voice customized", 
                       clone_id=clone_id,
                       voice=customized_profile["voice"],
                       model=customized_profile["model"])
            
            return customized_profile
            
        except Exception as e:
            logger.error("Voice customization failed", error=str(e), clone_id=clone_id)
            raise

    async def generate_sample_audio(
        self,
        voice: str = "alloy",
        model: str = "tts-1",
        speed: float = 1.0
    ) -> bytes:
        """Generate a sample audio for voice preview"""
        if not self._ensure_client():
            return b''
            
        sample_text = "Hello! I'm your AI clone assistant. I'm here to help you with any questions or guidance you might need. How can I assist you today?"
        
        voice_profile = {
            "provider": "openai",
            "voice": voice,
            "model": model,
            "speed": speed
        }
        
        return await self._synthesize_openai(sample_text, voice_profile)

    async def cleanup_cache(self, max_age_hours: int = 24) -> None:
        """Clean up old cached audio files"""
        try:
            temp_dir = Path(tempfile.gettempdir()) / "cloneai_audio_cache"
            if not temp_dir.exists():
                return
            
            import time
            current_time = time.time()
            max_age_seconds = max_age_hours * 3600
            
            removed_count = 0
            for cache_file in temp_dir.glob("*.mp3"):
                try:
                    file_age = current_time - cache_file.stat().st_mtime
                    if file_age > max_age_seconds:
                        cache_file.unlink()
                        removed_count += 1
                        
                        # Remove from in-memory cache too
                        cache_key = cache_file.stem
                        if cache_key in self.audio_cache:
                            del self.audio_cache[cache_key]
                            
                except Exception as e:
                    logger.warning("Failed to remove cached audio file", 
                                 file=str(cache_file), error=str(e))
            
            if removed_count > 0:
                logger.info("Cleaned up cached audio files", removed_count=removed_count)
                
        except Exception as e:
            logger.error("Cache cleanup failed", error=str(e))

# Global service instance
voice_synthesis_service = VoiceSynthesisService()

# Utility function for easy access
async def synthesize_clone_speech(
    text: str,
    clone_id: str,
    clone_category: str = "default",
    voice_settings: Optional[Dict[str, Any]] = None
) -> bytes:
    """Convenience function for speech synthesis"""
    return await voice_synthesis_service.synthesize_speech(
        text, clone_id, clone_category, voice_settings
    )