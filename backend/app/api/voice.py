from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from app.services.elevenlabs_service import get_elevenlabs_service
from app.core.supabase_auth import get_current_user_id
from typing import List
import io
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/voice", tags=["voice"])

@router.post("/clone-voice")
async def clone_voice(
    voice_name: str = Form(..., description="Name for the cloned voice"),
    audio_files: List[UploadFile] = File(..., description="Audio files for voice cloning"),
    user_id: str = Depends(get_current_user_id)
):
    """Clone a voice from uploaded audio samples"""
    try:
        logger.info(f"User {user_id} starting voice clone: {voice_name}")
        
        # Validate files
        if len(audio_files) == 0:
            raise HTTPException(status_code=400, detail="At least one audio file is required")
        
        if len(audio_files) > 5:
            raise HTTPException(status_code=400, detail="Maximum 5 audio files allowed")
        
        # Read audio files
        audio_data = []
        for i, file in enumerate(audio_files):
            # Check file type
            if not file.content_type or not file.content_type.startswith('audio/'):
                raise HTTPException(
                    status_code=400, 
                    detail=f"File {file.filename} is not an audio file"
                )
            
            # Read file content
            content = await file.read()
            if len(content) == 0:
                raise HTTPException(
                    status_code=400, 
                    detail=f"File {file.filename} is empty"
                )
            
            audio_data.append(content)
            logger.info(f"Read audio file {i+1}: {file.filename}, size: {len(content)} bytes")
        
        # Get ElevenLabs service
        elevenlabs_service = get_elevenlabs_service()
        
        # Create unique voice name with user ID
        unique_voice_name = f"{voice_name}_{user_id[:8]}"
        
        # Clone voice with ElevenLabs
        voice_id = await elevenlabs_service.clone_voice(
            name=unique_voice_name,
            audio_files=audio_data,
            description=f"Voice clone for user {user_id}"
        )
        
        logger.info(f"Voice cloned successfully: {voice_id}")
        
        return {
            "success": True,
            "voice_id": voice_id,
            "voice_name": unique_voice_name,
            "message": f"Voice '{voice_name}' cloned successfully!"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Voice cloning failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Voice cloning failed: {str(e)}")

@router.post("/test-voice")
async def test_voice(
    text: str = Form(..., description="Text to convert to speech"),
    voice_id: str = Form(..., description="ID of the voice to use"),
    user_id: str = Depends(get_current_user_id)
):
    """Generate speech using a voice ID (for testing)"""
    try:
        logger.info(f"User {user_id} testing voice {voice_id}")
        
        # Validate input
        if not text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        if len(text) > 500:
            raise HTTPException(status_code=400, detail="Text too long (max 500 characters)")
        
        # Get ElevenLabs service
        elevenlabs_service = get_elevenlabs_service()
        
        # Generate speech
        audio_data = await elevenlabs_service.generate_speech(text, voice_id)
        
        logger.info(f"Speech generated successfully, {len(audio_data)} bytes")
        
        # Return as streaming audio
        return StreamingResponse(
            io.BytesIO(audio_data),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "attachment; filename=test_speech.mp3"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Speech generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Speech generation failed: {str(e)}")

@router.get("/voices")
async def get_voices(user_id: str = Depends(get_current_user_id)):
    """Get all available voices for the user"""
    try:
        elevenlabs_service = get_elevenlabs_service()
        voices = await elevenlabs_service.get_voices()
        
        # Format response
        voice_list = []
        for voice in voices:
            voice_list.append({
                "voice_id": voice.voice_id,
                "name": voice.name,
                "category": voice.category if hasattr(voice, 'category') else 'unknown'
            })
        
        return {
            "success": True,
            "voices": voice_list,
            "count": len(voice_list)
        }
        
    except Exception as e:
        logger.error(f"Failed to get voices: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get voices: {str(e)}")
    

@router.get("/test-connection")
async def test_connection():
    """Test ElevenLabs connection (no auth required)"""
    try:
        elevenlabs_service = get_elevenlabs_service()
        voices = await elevenlabs_service.get_voices()
        
        return {
            "success": True,
            "message": "ElevenLabs connected successfully",
            "voice_count": len(voices),
            "sample_voices": [v.name for v in voices[:3]]
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

@router.post("/clone-voice-test")
async def clone_voice_test(
    voice_name: str = Form(..., description="Name for the cloned voice"),
    audio_files: List[UploadFile] = File(..., description="Audio files for voice cloning")
):
    """Clone a voice from uploaded audio samples (NO AUTH - for testing)"""
    try:
        logger.info(f"Testing voice clone: {voice_name}")
        
        # Validate files
        if len(audio_files) == 0:
            raise HTTPException(status_code=400, detail="At least one audio file is required")
        
        # Read audio files
        audio_data = []
        for i, file in enumerate(audio_files):
            content = await file.read()
            audio_data.append(content)
            logger.info(f"Read audio file {i+1}: {file.filename}, size: {len(content)} bytes")
        
        # Get ElevenLabs service
        elevenlabs_service = get_elevenlabs_service()
        
        # Create unique voice name
        unique_voice_name = f"{voice_name}_test"
        
        # Clone voice with ElevenLabs
        voice_id = await elevenlabs_service.clone_voice(
            name=unique_voice_name,
            audio_files=audio_data,
            description=f"Test voice clone"
        )
        
        logger.info(f"Voice cloned successfully: {voice_id}")
        
        return {
            "success": True,
            "voice_id": voice_id,
            "voice_name": unique_voice_name,
            "message": f"Voice '{voice_name}' cloned successfully!"
        }
        
    except Exception as e:
        logger.error(f"Voice cloning failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Voice cloning failed: {str(e)}")

@router.post("/test-voice-no-auth")
async def test_voice_no_auth(
    text: str = Form(..., description="Text to convert to speech"),
    voice_id: str = Form(..., description="ID of the voice to use")
):
    """Generate speech using a voice ID (NO AUTH - for testing)"""
    try:
        logger.info(f"Testing speech generation with voice {voice_id}")
        
        # Validate input
        if not text.strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        
        if len(text) > 500:
            raise HTTPException(status_code=400, detail="Text too long (max 500 characters)")
        
        # Get ElevenLabs service
        elevenlabs_service = get_elevenlabs_service()
        
        # Generate speech
        audio_data = await elevenlabs_service.generate_speech(text, voice_id)
        
        logger.info(f"Speech generated successfully, {len(audio_data)} bytes")
        
        # Return as streaming audio
        return StreamingResponse(
            io.BytesIO(audio_data),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "attachment; filename=test_speech.mp3"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Speech generation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Speech generation failed: {str(e)}")