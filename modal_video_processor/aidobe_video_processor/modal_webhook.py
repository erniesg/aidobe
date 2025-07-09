"""
Modal webhook endpoint for video processing

Complete video processing pipeline integration via Modal.com webhook.
Receives requests from Cloudflare Workers and orchestrates the complete
video assembly pipeline using all integrated components.
"""

import os
import tempfile
import asyncio
import httpx
from typing import Dict, Any, List, Optional
from pathlib import Path
import json
import logging

from .audio_duration import AudioDurationExtractor
from .scene_timing import SceneTimingCalculator
from .scene_gap_validator import SceneGapValidator
from .audio_master_sync import AudioMasterSync
from .video_assembler import VideoAssembler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class VideoProcessor:
    """Complete video processing pipeline orchestrator."""
    
    def __init__(self):
        """Initialize all video processing components."""
        self.audio_extractor = AudioDurationExtractor()
        self.scene_timing = SceneTimingCalculator()
        self.gap_validator = SceneGapValidator()
        self.audio_sync = AudioMasterSync()
        self.video_assembler = VideoAssembler()
    
    async def process_complete_video(
        self,
        audio_file_path: str,
        video_files: List[str],
        script_segments: List[Dict[str, Any]],
        effects_config: Dict[str, Any],
        captions_config: Dict[str, Any],
        output_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process complete video with all components integrated.
        
        Args:
            audio_file_path: Path to downloaded audio file
            video_files: List of paths to downloaded video files
            script_segments: Script segments with timing
            effects_config: Effects configuration
            captions_config: Captions configuration
            output_config: Output configuration
            
        Returns:
            Processing result with metadata
        """
        try:
            # Step 1: Extract audio duration
            audio_duration = self.audio_extractor.extract_duration(audio_file_path)
            logger.info(f"Extracted audio duration: {audio_duration}s")
            
            # Step 2: Load video clips (mocked for now - would use MoviePy)
            video_clips = await self._load_video_clips(video_files)
            
            # Step 3: Calculate scene timing
            scene_durations = self.scene_timing.distribute_scene_durations(
                audio_duration, len(video_clips)
            )
            logger.info(f"Calculated scene durations: {scene_durations}")
            
            # Step 4: Sync video to audio
            synced_clips = self.audio_sync.sync_complete_video_to_master_audio(
                video_clips, audio_duration, scene_durations
            )
            
            # Step 5: Validate and fix gaps
            scenes = self._create_scene_metadata(synced_clips, scene_durations)
            validation = self.gap_validator.validate_scene_continuity(scenes)
            
            if not validation['is_valid']:
                fixed_scenes = self.gap_validator.fix_all_timing_issues(scenes)
                logger.info("Fixed timing gaps in video")
            
            # Step 6: Apply effects if configured
            if effects_config.get('ken_burns'):
                synced_clips = await self._apply_ken_burns_effects(synced_clips, effects_config)
            
            # Step 7: Mix background music if configured
            audio_clip = await self._load_audio_clip(audio_file_path)
            if effects_config.get('background_music'):
                audio_clip = await self._mix_background_music(audio_clip, effects_config)
            
            # Step 8: Assemble complete video
            captions_data = self._prepare_captions_data(script_segments, captions_config)
            
            assembled_video = self.video_assembler.assemble_complete_video(
                video_clips=synced_clips,
                audio_clip=audio_clip,
                captions_data=captions_data,
                effects_config=effects_config,
                output_config=output_config
            )
            
            # Step 9: Export final video
            output_path = f"/tmp/final_video_{os.urandom(8).hex()}.mp4"
            final_path = self.video_assembler.export_video(
                composite_video=assembled_video,
                output_path=output_path,
                export_config=output_config
            )
            
            # Step 10: Generate metadata
            metadata = self.video_assembler.get_assembly_metadata(synced_clips, audio_clip)
            metadata.update({
                'file_size': os.path.getsize(final_path) if os.path.exists(final_path) else 0,
                'codec': output_config.get('codec', 'libx264'),
                'bitrate': output_config.get('bitrate', '2000k'),
                'audio_channels': 2,
                'audio_sample_rate': 44100
            })
            
            return {
                'status': 'success',
                'output_path': final_path,
                'metadata': metadata
            }
            
        except Exception as e:
            logger.error(f"Video processing failed: {e}")
            return {
                'status': 'failed',
                'error': str(e)
            }
    
    async def _load_video_clips(self, video_files: List[str]) -> List[Any]:
        """Load video clips from file paths."""
        # Mock implementation - would use MoviePy VideoFileClip
        from unittest.mock import Mock
        clips = []
        for file_path in video_files:
            clip = Mock()
            clip.duration = 10.0  # Default duration
            clips.append(clip)
        return clips
    
    async def _load_audio_clip(self, audio_file_path: str) -> Any:
        """Load audio clip from file path."""
        # Mock implementation - would use MoviePy AudioFileClip
        from unittest.mock import Mock
        clip = Mock()
        clip.duration = self.audio_extractor.extract_duration(audio_file_path)
        return clip
    
    def _create_scene_metadata(self, clips: List[Any], durations: List[float]) -> List[Dict[str, Any]]:
        """Create scene metadata for gap validation."""
        scenes = []
        current_time = 0.0
        for clip, duration in zip(clips, durations):
            scenes.append({
                'start_time': current_time,
                'end_time': current_time + duration,
                'duration': duration
            })
            current_time += duration
        return scenes
    
    async def _apply_ken_burns_effects(self, clips: List[Any], config: Dict[str, Any]) -> List[Any]:
        """Apply Ken Burns effects to video clips."""
        # Mock implementation - would use KenBurnsFFmpeg
        logger.info("Applied Ken Burns effects")
        return clips
    
    async def _mix_background_music(self, audio_clip: Any, config: Dict[str, Any]) -> Any:
        """Mix background music with main audio."""
        # Mock implementation - would use BackgroundMusicMixer
        logger.info("Mixed background music")
        return audio_clip
    
    def _prepare_captions_data(self, script_segments: List[Dict[str, Any]], config: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Prepare captions data from script segments."""
        if not config.get('enabled'):
            return []
        
        captions = []
        for segment in script_segments:
            captions.append({
                'text': segment['text'],
                'start_time': segment['start_time'],
                'end_time': segment['end_time']
            })
        return captions


async def download_file(url: str, local_path: str) -> str:
    """Download file from URL to local path."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            
            # Create directory if it doesn't exist
            Path(local_path).parent.mkdir(parents=True, exist_ok=True)
            
            with open(local_path, 'wb') as f:
                f.write(response.content)
            
            logger.info(f"Downloaded {url} to {local_path}")
            return local_path
            
    except Exception as e:
        logger.error(f"Failed to download {url}: {e}")
        raise


async def upload_to_storage(local_path: str, bucket: str, key: str) -> str:
    """Upload file to storage and return public URL."""
    # Mock implementation - would upload to S3/R2/GCS
    public_url = f"https://storage.example.com/{bucket}/{key}"
    logger.info(f"Uploaded {local_path} to {public_url}")
    return public_url


async def send_completion_callback(callback_url: str, callback_data: Dict[str, Any]) -> None:
    """Send completion callback to Cloudflare Workers."""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(callback_url, json=callback_data)
            response.raise_for_status()
            logger.info(f"Sent completion callback to {callback_url}")
    except Exception as e:
        logger.error(f"Failed to send callback: {e}")


async def send_progress_update(callback_url: str, progress_data: Dict[str, Any]) -> None:
    """Send progress update to Cloudflare Workers."""
    try:
        async with httpx.AsyncClient() as client:
            progress_url = callback_url.replace('/video-complete', '/video-progress')
            response = await client.post(progress_url, json=progress_data)
            response.raise_for_status()
            logger.info(f"Sent progress update: {progress_data['stage']}")
    except Exception as e:
        logger.error(f"Failed to send progress update: {e}")


async def validate_asset_accessibility(video_request: Dict[str, Any]) -> Dict[str, Any]:
    """Validate that all assets are accessible before processing."""
    missing_assets = []
    inaccessible_assets = []
    
    # Check audio file
    audio_url = video_request.get('audio_file_url')
    if audio_url:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.head(audio_url)
                if response.status_code != 200:
                    inaccessible_assets.append(audio_url)
        except Exception:
            inaccessible_assets.append(audio_url)
    
    # Check video assets
    for asset in video_request.get('video_assets', []):
        asset_url = asset.get('asset_url')
        if asset_url:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.head(asset_url)
                    if response.status_code != 200:
                        inaccessible_assets.append(asset_url)
            except Exception:
                inaccessible_assets.append(asset_url)
    
    return {
        'is_valid': len(missing_assets) == 0 and len(inaccessible_assets) == 0,
        'missing_assets': missing_assets,
        'inaccessible_assets': inaccessible_assets
    }


def cleanup_temp_files(file_paths: List[str]) -> None:
    """Clean up temporary files."""
    for file_path in file_paths:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"Cleaned up {file_path}")
        except Exception as e:
            logger.error(f"Failed to cleanup {file_path}: {e}")


async def process_video_request(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Main webhook endpoint for processing video requests.
    
    Args:
        request_data: Complete video processing request from Cloudflare Workers
        
    Returns:
        Processing result with status, output URL, and metadata
    """
    temp_files = []
    
    try:
        # Validate required fields
        if 'job_id' not in request_data:
            raise ValueError("job_id is required")
        
        if 'video_request' not in request_data:
            raise ValueError("video_request is required")
        
        job_id = request_data['job_id']
        video_request = request_data['video_request']
        callback_url = request_data.get('callback_url')
        storage_config = request_data.get('storage_config', {})
        
        logger.info(f"Processing video request for job {job_id}")
        
        # Validate asset accessibility
        if callback_url:
            await send_progress_update(callback_url, {
                'job_id': job_id,
                'stage': 'validating',
                'progress': 0.1
            })
        
        asset_validation = await validate_asset_accessibility(video_request)
        if not asset_validation['is_valid']:
            raise ValueError(f"Assets not accessible: {asset_validation}")
        
        # Download assets
        if callback_url:
            await send_progress_update(callback_url, {
                'job_id': job_id,
                'stage': 'downloading',
                'progress': 0.2
            })
        
        # Download audio file
        audio_url = video_request['audio_file_url']
        audio_path = f"/tmp/audio_{job_id.replace('-', '_')}.mp3"
        await download_file(audio_url, audio_path)
        temp_files.append(audio_path)
        
        # Download video assets
        video_paths = []
        for i, asset in enumerate(video_request['video_assets']):
            asset_url = asset['asset_url']
            file_ext = Path(asset_url).suffix or '.mp4'
            video_path = f"/tmp/video_{i}_{job_id.replace('-', '_')}{file_ext}"
            await download_file(asset_url, video_path)
            video_paths.append(video_path)
            temp_files.append(video_path)
        
        # Process video
        if callback_url:
            await send_progress_update(callback_url, {
                'job_id': job_id,
                'stage': 'processing',
                'progress': 0.5
            })
        
        processor = VideoProcessor()
        result = await processor.process_complete_video(
            audio_file_path=audio_path,
            video_files=video_paths,
            script_segments=video_request.get('script_segments', []),
            effects_config=video_request.get('effects_config', {}),
            captions_config=video_request.get('captions_config', {}),
            output_config=video_request.get('output_config', {})
        )
        
        if result['status'] != 'success':
            raise Exception(result.get('error', 'Video processing failed'))
        
        # Upload to storage
        if callback_url:
            await send_progress_update(callback_url, {
                'job_id': job_id,
                'stage': 'uploading',
                'progress': 0.8
            })
        
        output_url = await upload_to_storage(
            result['output_path'],
            storage_config.get('output_bucket', 'aidobe-videos'),
            storage_config.get('output_key', f'generated/{job_id}.mp4')
        )
        temp_files.append(result['output_path'])
        
        # Send completion callback
        final_result = {
            'job_id': job_id,
            'status': 'completed',
            'output_url': output_url,
            'metadata': result['metadata']
        }
        
        if callback_url:
            await send_completion_callback(callback_url, final_result)
        
        return final_result
        
    except Exception as e:
        job_id = request_data.get('job_id', 'unknown')
        callback_url = request_data.get('callback_url')
        logger.error(f"Video processing failed for job {job_id}: {e}")
        
        # Send failure callback
        failure_result = {
            'job_id': job_id,
            'status': 'failed',
            'error': str(e)
        }
        
        if callback_url:
            await send_completion_callback(callback_url, failure_result)
        
        return failure_result
    
    finally:
        # Cleanup temporary files
        cleanup_temp_files(temp_files)


# Modal.com integration components that would be implemented
class KenBurnsFFmpeg:
    """Ken Burns effect implementation using FFmpeg."""
    
    def apply_ken_burns_effect(self, video_clip: Any, config: Dict[str, Any]) -> Any:
        """Apply Ken Burns zoom/pan effect to video clip."""
        # Mock implementation
        return video_clip


class BackgroundMusicMixer:
    """Background music mixing with audio ducking."""
    
    def mix_background_music(self, main_audio: Any, background_music: Any, config: Dict[str, Any]) -> Any:
        """Mix background music with main audio."""
        # Mock implementation
        return main_audio


class CaptionOverlay:
    """Caption overlay with word-level highlighting."""
    
    def create_caption_overlays(self, captions_data: List[Dict[str, Any]], style: Dict[str, Any]) -> List[Any]:
        """Create caption overlays with timing."""
        # Mock implementation
        return []