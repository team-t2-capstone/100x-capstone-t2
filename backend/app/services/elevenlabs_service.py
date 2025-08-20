from elevenlabs import ElevenLabs, VoiceSettings, Voice
import asyncio
import os
from typing import Optional, List, Union
import logging
import io
import requests

logger = logging.getLogger(__name__)

class ElevenLabsService:
    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("ElevenLabs API key is required")
        self.client = ElevenLabs(api_key=api_key)
        self.api_key = api_key
    
    async def clone_voice(self, name: str, audio_files: List[Union[bytes, io.BytesIO]], description: str = "") -> str:
        """Clone a voice from audio samples"""
        try:
            logger.info(f"Starting voice cloning for: {name} with {len(audio_files)} audio files")
            
            # Convert bytes to file-like objects with proper names
            file_objects = []
            for i, audio_data in enumerate(audio_files):
                if isinstance(audio_data, bytes):
                    file_obj = io.BytesIO(audio_data)
                    file_obj.name = f"sample_{i}.wav"
                    file_objects.append(file_obj)
                else:
                    file_objects.append(audio_data)
            
            # Use ElevenLabs SDK v2.9.2 API for voice cloning
            try:
                # Create voice using the client.voices.create method
                voice_response = await asyncio.to_thread(
                    self.client.voices.create,
                    name=name,
                    files=file_objects,
                    description=description
                )
                
                logger.info(f"Voice cloned successfully with ID: {voice_response.voice_id}")
                return voice_response.voice_id
                
            except Exception as e:
                logger.error(f"SDK method failed: {str(e)}")
                
                # Fallback to direct API call if SDK method fails
                logger.info("Trying direct API call approach...")
                
                # Make direct API call to ElevenLabs
                url = "https://api.elevenlabs.io/v1/voices/add"
                headers = {
                    "Accept": "application/json",
                    "xi-api-key": self.api_key
                }
                
                # Prepare files for upload
                files_for_request = []
                for i, file_obj in enumerate(file_objects):
                    # Reset file position to beginning
                    file_obj.seek(0)
                    files_for_request.append(('files', (f'sample_{i}.wav', file_obj, 'audio/wav')))
                
                data = {
                    'name': name,
                    'description': description
                }
                
                response = requests.post(url, headers=headers, data=data, files=files_for_request)
                
                if response.status_code == 200:
                    result = response.json()
                    voice_id = result.get('voice_id')
                    if voice_id:
                        logger.info(f"Voice cloned successfully via direct API, ID: {voice_id}")
                        return voice_id
                    else:
                        raise Exception("No voice_id in response")
                else:
                    raise Exception(f"API call failed with status {response.status_code}: {response.text}")
                
        except Exception as e:
            logger.error(f"Voice cloning failed for {name}: {str(e)}")
            raise Exception(f"Voice cloning failed: {str(e)}")
    
    async def generate_speech(self, text: str, voice_id: str) -> bytes:
        """Generate speech from text using cloned voice
        
        Args:
            text: Text to convert to speech
            voice_id: ID of the voice to use
            
        Returns:
            bytes: Audio data in MP3 format
        """
        try:
            # Validate inputs
            if not text.strip():
                raise ValueError("Text cannot be empty")
            if not voice_id:
                raise ValueError("Voice ID is required")
            
            # Basic quota check for basic plan (10k chars/month)
            if len(text) > 1000:
                logger.warning(f"Text length {len(text)} chars - may use significant quota")
            
            logger.info(f"Generating speech for voice_id: {voice_id}, text length: {len(text)} chars")
            
            # Use ElevenLabs SDK v2.9.2 API for speech generation
            try:
                # Use the text-to-speech method from the SDK
                audio_generator = await asyncio.to_thread(
                    self.client.text_to_speech.convert,
                    voice_id=voice_id,
                    text=text,
                    voice_settings=VoiceSettings(
                        stability=0.5,
                        similarity_boost=0.75,
                        style=0.0,
                        use_speaker_boost=True
                    ),
                    model_id="eleven_monolingual_v1"
                )
                
                # Convert generator/response to bytes
                if hasattr(audio_generator, '__iter__'):
                    audio_bytes = b"".join(audio_generator)
                else:
                    audio_bytes = audio_generator
                
                logger.info(f"Speech generated successfully, {len(audio_bytes)} bytes")
                return audio_bytes
                
            except Exception as e:
                logger.error(f"SDK method failed: {str(e)}")
                
                # Fallback to direct API call
                logger.info("Trying direct API call approach...")
                
                # Make direct API call to ElevenLabs
                url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
                headers = {
                    "Accept": "audio/mpeg",
                    "Content-Type": "application/json",
                    "xi-api-key": self.api_key
                }
                
                data = {
                    "text": text,
                    "model_id": "eleven_monolingual_v1",
                    "voice_settings": {
                        "stability": 0.5,
                        "similarity_boost": 0.75,
                        "style": 0.0,
                        "use_speaker_boost": True
                    }
                }
                
                response = requests.post(url, headers=headers, json=data)
                
                if response.status_code == 200:
                    audio_bytes = response.content
                    logger.info(f"Speech generated successfully via direct API, {len(audio_bytes)} bytes")
                    return audio_bytes
                else:
                    raise Exception(f"API call failed with status {response.status_code}: {response.text}")
            
        except Exception as e:
            logger.error(f"Speech generation failed for voice {voice_id}: {str(e)}")
            raise Exception(f"Speech generation failed: {str(e)}")
    
    async def get_voices(self) -> List[Voice]:
        """Get all available voices (including cloned ones)"""
        try:
            voices_response = await asyncio.to_thread(self.client.voices.get_all)
            voices = voices_response.voices if hasattr(voices_response, 'voices') else voices_response
            logger.info(f"Retrieved {len(voices)} voices")
            return voices
        except Exception as e:
            logger.error(f"Failed to get voices: {str(e)}")
            raise Exception(f"Failed to get voices: {str(e)}")
    
    async def get_voice_by_id(self, voice_id: str) -> Optional[Voice]:
        """Get a specific voice by ID"""
        try:
            voice = await asyncio.to_thread(self.client.voices.get, voice_id)
            return voice
        except Exception as e:
            logger.error(f"Failed to get voice {voice_id}: {str(e)}")
            return None
    
    async def delete_voice(self, voice_id: str) -> bool:
        """Delete a cloned voice"""
        try:
            await asyncio.to_thread(self.client.voices.delete, voice_id)
            logger.info(f"Voice {voice_id} deleted successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to delete voice {voice_id}: {str(e)}")
            return False
    
    async def test_connection(self) -> bool:
        """Test if the API connection is working"""
        try:
            await self.get_voices()
            return True
        except Exception as e:
            logger.error(f"Connection test failed: {str(e)}")
            return False

# Singleton instance
_elevenlabs_service = None

def get_elevenlabs_service() -> ElevenLabsService:
    """Get or create ElevenLabs service instance"""
    global _elevenlabs_service
    
    if _elevenlabs_service is None:
        api_key = os.getenv("ELEVENLABS_API_KEY")
        if not api_key:
            raise ValueError("ELEVENLABS_API_KEY environment variable is required")
        _elevenlabs_service = ElevenLabsService(api_key)
    
    return _elevenlabs_service