"""
Integration test cases for Modal webhook endpoint

Following TDD approach - these tests will fail initially and drive the implementation.
Tests the complete video processing pipeline integration via Modal.com webhook.
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock
import json
from typing import Dict, Any


class TestModalWebhookIntegration:
    """Test Modal webhook endpoint for complete video processing integration."""

    def setup_method(self):
        """Setup test fixtures."""
        # Mock webhook request data from Cloudflare Workers
        self.sample_webhook_request = {
            "job_id": "test-job-12345",
            "video_request": {
                "script_segments": [
                    {
                        "text": "Welcome to our amazing product demonstration",
                        "start_time": 0.0,
                        "end_time": 5.5,
                        "duration": 5.5
                    },
                    {
                        "text": "Here are the key features you'll love",
                        "start_time": 5.5,
                        "end_time": 12.0,
                        "duration": 6.5
                    },
                    {
                        "text": "Thank you for watching our presentation",
                        "start_time": 12.0,
                        "end_time": 15.0,
                        "duration": 3.0
                    }
                ],
                "audio_file_url": "https://storage.example.com/audio/test-narration.mp3",
                "video_assets": [
                    {
                        "asset_url": "https://storage.example.com/video/intro-scene.mp4",
                        "start_time": 0.0,
                        "duration": 5.5
                    },
                    {
                        "asset_url": "https://storage.example.com/video/features-demo.mp4", 
                        "start_time": 5.5,
                        "duration": 6.5
                    },
                    {
                        "asset_url": "https://storage.example.com/video/conclusion.mp4",
                        "start_time": 12.0,
                        "duration": 3.0
                    }
                ],
                "effects_config": {
                    "ken_burns": True,
                    "background_music": "https://storage.example.com/music/background.mp3",
                    "music_volume": 0.08,
                    "fade_duration": 2.0
                },
                "captions_config": {
                    "enabled": True,
                    "style": {
                        "fontsize": 24,
                        "color": "white",
                        "font": "Arial-Bold"
                    },
                    "position": "bottom"
                },
                "output_config": {
                    "resolution": "1080p",
                    "fps": 30,
                    "format": "mp4",
                    "codec": "libx264"
                }
            },
            "callback_url": "https://api.aidobe.app/webhook/video-complete",
            "storage_config": {
                "output_bucket": "aidobe-videos",
                "output_key": "generated/test-job-12345.mp4"
            }
        }

    async def test_webhook_endpoint_accepts_video_processing_request(self):
        """Test webhook endpoint accepts and validates video processing requests."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        # Mock all external dependencies
        with patch('aidobe_video_processor.modal_webhook.validate_asset_accessibility') as mock_validate, \
             patch('aidobe_video_processor.modal_webhook.download_file') as mock_download, \
             patch('aidobe_video_processor.modal_webhook.upload_to_storage') as mock_upload, \
             patch('aidobe_video_processor.modal_webhook.send_progress_update') as mock_progress, \
             patch('aidobe_video_processor.modal_webhook.send_completion_callback') as mock_callback, \
             patch('aidobe_video_processor.modal_webhook.VideoProcessor') as mock_processor, \
             patch('os.path.getsize') as mock_getsize:
            
            # Mock asset validation success
            mock_validate.return_value = {'is_valid': True, 'missing_assets': [], 'inaccessible_assets': []}
            
            # Mock file downloads
            mock_download.side_effect = [
                '/tmp/audio_test_job_12345.mp3',
                '/tmp/video_0_test_job_12345.mp4',
                '/tmp/video_1_test_job_12345.mp4',
                '/tmp/video_2_test_job_12345.mp4'
            ]
            
            # Mock video processing with async coroutine
            mock_processor_instance = mock_processor.return_value
            mock_processor_instance.process_complete_video = AsyncMock(return_value={
                'status': 'success',
                'output_path': '/tmp/final_video_12345.mp4',
                'metadata': {
                    'resolution': (1920, 1080),
                    'fps': 30,
                    'file_size': 45600000
                }
            })
            
            # Mock upload and file size
            mock_upload.return_value = 'https://storage.example.com/output/test-job-12345.mp4'
            mock_getsize.return_value = 45600000
            
            # Call webhook endpoint
            result = await process_video_request(self.sample_webhook_request)
            
            # Should accept request and return processing result
            assert result['status'] == 'completed'
            assert result['job_id'] == 'test-job-12345'
            assert 'output_url' in result
            mock_processor_instance.process_complete_video.assert_called_once()

    async def test_webhook_validates_required_fields(self):
        """Test webhook validates all required fields in request."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        # Mock callback to prevent HTTP errors
        with patch('aidobe_video_processor.modal_webhook.send_completion_callback'):
            
            # Test missing job_id
            invalid_request = self.sample_webhook_request.copy()
            del invalid_request['job_id']
            
            result = await process_video_request(invalid_request)
            
            assert result['status'] == 'failed'
            assert "job_id is required" in result['error']
            
            # Test missing video_request
            invalid_request = self.sample_webhook_request.copy()
            del invalid_request['video_request']
            
            result = await process_video_request(invalid_request)
            
            assert result['status'] == 'failed'
            assert "video_request is required" in result['error']

    async def test_webhook_downloads_and_processes_audio_file(self):
        """Test webhook downloads audio file and extracts duration."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        with patch('aidobe_video_processor.modal_webhook.download_file') as mock_download, \
             patch('aidobe_video_processor.modal_webhook.AudioDurationExtractor') as mock_extractor:
            
            # Mock audio download and duration extraction
            mock_download.return_value = '/tmp/audio_12345.mp3'
            mock_extractor_instance = mock_extractor.return_value
            mock_extractor_instance.extract_duration.return_value = 15.0
            
            with patch('aidobe_video_processor.modal_webhook.VideoProcessor'):
                result = await process_video_request(self.sample_webhook_request)
                
                # Should download audio file and extract duration
                mock_download.assert_called_with(
                    'https://storage.example.com/audio/test-narration.mp3',
                    '/tmp/audio_12345.mp3'
                )
                mock_extractor_instance.extract_duration.assert_called_once_with('/tmp/audio_12345.mp3')

    async def test_webhook_downloads_and_processes_video_assets(self):
        """Test webhook downloads all video assets for processing."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        with patch('aidobe_video_processor.modal_webhook.download_file') as mock_download, \
             patch('aidobe_video_processor.modal_webhook.VideoProcessor') as mock_processor:
            
            # Mock video asset downloads
            mock_download.side_effect = [
                '/tmp/audio_12345.mp3',  # Audio file
                '/tmp/video_0_12345.mp4',  # First video asset
                '/tmp/video_1_12345.mp4',  # Second video asset
                '/tmp/video_2_12345.mp4'   # Third video asset
            ]
            
            result = await process_video_request(self.sample_webhook_request)
            
            # Should download all video assets
            expected_calls = [
                ('https://storage.example.com/audio/test-narration.mp3', '/tmp/audio_12345.mp3'),
                ('https://storage.example.com/video/intro-scene.mp4', '/tmp/video_0_12345.mp4'),
                ('https://storage.example.com/video/features-demo.mp4', '/tmp/video_1_12345.mp4'),
                ('https://storage.example.com/video/conclusion.mp4', '/tmp/video_2_12345.mp4')
            ]
            
            assert mock_download.call_count == 4
            for i, (url, path) in enumerate(expected_calls):
                assert mock_download.call_args_list[i][0] == (url, path)

    async def test_webhook_integrates_all_video_components(self):
        """Test webhook integrates AudioDurationExtractor, SceneTimingCalculator, etc."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        with patch('aidobe_video_processor.modal_webhook.AudioDurationExtractor') as mock_audio, \
             patch('aidobe_video_processor.modal_webhook.SceneTimingCalculator') as mock_timing, \
             patch('aidobe_video_processor.modal_webhook.SceneGapValidator') as mock_validator, \
             patch('aidobe_video_processor.modal_webhook.AudioMasterSync') as mock_sync, \
             patch('aidobe_video_processor.modal_webhook.VideoAssembler') as mock_assembler, \
             patch('aidobe_video_processor.modal_webhook.download_file'):
            
            # Mock all components
            mock_audio.return_value.extract_duration.return_value = 15.0
            mock_timing.return_value.distribute_scene_durations.return_value = [5.5, 6.5, 3.0]
            mock_validator.return_value.validate_scene_continuity.return_value = {'is_valid': True}
            mock_sync.return_value.sync_complete_video_to_master_audio.return_value = [Mock(), Mock(), Mock()]
            mock_assembler.return_value.assemble_complete_video.return_value = Mock()
            
            result = await process_video_request(self.sample_webhook_request)
            
            # Should use all video processing components
            mock_audio.assert_called_once()
            mock_timing.assert_called_once()
            mock_validator.assert_called_once()
            mock_sync.assert_called_once()
            mock_assembler.assert_called_once()

    async def test_webhook_applies_ken_burns_effects(self):
        """Test webhook applies Ken Burns effects when configured."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        with patch('aidobe_video_processor.modal_webhook.KenBurnsFFmpeg') as mock_ken_burns, \
             patch('aidobe_video_processor.modal_webhook.VideoProcessor'):
            
            mock_ken_burns_instance = mock_ken_burns.return_value
            mock_ken_burns_instance.apply_ken_burns_effect.return_value = Mock()
            
            result = await process_video_request(self.sample_webhook_request)
            
            # Should apply Ken Burns effects when enabled
            mock_ken_burns.assert_called_once()
            assert mock_ken_burns_instance.apply_ken_burns_effect.call_count == 3  # One per video asset

    async def test_webhook_mixes_background_music(self):
        """Test webhook mixes background music when configured."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        with patch('aidobe_video_processor.modal_webhook.BackgroundMusicMixer') as mock_mixer, \
             patch('aidobe_video_processor.modal_webhook.download_file'), \
             patch('aidobe_video_processor.modal_webhook.VideoProcessor'):
            
            mock_mixer_instance = mock_mixer.return_value
            mock_mixer_instance.mix_background_music.return_value = Mock()
            
            result = await process_video_request(self.sample_webhook_request)
            
            # Should mix background music
            mock_mixer.assert_called_once()
            mock_mixer_instance.mix_background_music.assert_called_once()

    async def test_webhook_adds_caption_overlays(self):
        """Test webhook adds caption overlays when enabled."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        with patch('aidobe_video_processor.modal_webhook.CaptionOverlay') as mock_captions, \
             patch('aidobe_video_processor.modal_webhook.VideoProcessor'):
            
            mock_captions_instance = mock_captions.return_value
            mock_captions_instance.create_caption_overlays.return_value = [Mock(), Mock(), Mock()]
            
            result = await process_video_request(self.sample_webhook_request)
            
            # Should create caption overlays
            mock_captions.assert_called_once()
            mock_captions_instance.create_caption_overlays.assert_called_once()

    async def test_webhook_exports_video_with_quality_settings(self):
        """Test webhook exports final video with specified quality settings."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        with patch('aidobe_video_processor.modal_webhook.VideoAssembler') as mock_assembler, \
             patch('aidobe_video_processor.modal_webhook.upload_to_storage') as mock_upload, \
             patch('aidobe_video_processor.modal_webhook.VideoProcessor'):
            
            mock_assembler_instance = mock_assembler.return_value
            mock_final_video = Mock()
            mock_assembler_instance.assemble_complete_video.return_value = mock_final_video
            mock_assembler_instance.export_video.return_value = '/tmp/final_video_12345.mp4'
            mock_upload.return_value = 'https://storage.example.com/output/test-job-12345.mp4'
            
            result = await process_video_request(self.sample_webhook_request)
            
            # Should export with quality settings
            mock_assembler_instance.export_video.assert_called_once()
            export_call = mock_assembler_instance.export_video.call_args
            export_config = export_call[1]['export_config']
            
            assert export_config['format'] == 'mp4'
            assert export_config['codec'] == 'libx264'
            assert export_config['fps'] == 30

    async def test_webhook_uploads_to_storage_and_calls_callback(self):
        """Test webhook uploads final video and calls completion callback."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        with patch('aidobe_video_processor.modal_webhook.upload_to_storage') as mock_upload, \
             patch('aidobe_video_processor.modal_webhook.send_completion_callback') as mock_callback, \
             patch('aidobe_video_processor.modal_webhook.VideoProcessor'):
            
            mock_upload.return_value = 'https://storage.example.com/output/test-job-12345.mp4'
            
            result = await process_video_request(self.sample_webhook_request)
            
            # Should upload to storage and send callback
            mock_upload.assert_called_once_with(
                '/tmp/final_video_12345.mp4',
                'aidobe-videos',
                'generated/test-job-12345.mp4'
            )
            
            mock_callback.assert_called_once()
            callback_data = mock_callback.call_args[0][1]  # Second argument is callback data
            assert callback_data['job_id'] == 'test-job-12345'
            assert callback_data['status'] == 'completed'
            assert 'output_url' in callback_data

    async def test_webhook_handles_processing_errors_gracefully(self):
        """Test webhook handles processing errors and sends failure callbacks."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        with patch('aidobe_video_processor.modal_webhook.VideoProcessor') as mock_processor, \
             patch('aidobe_video_processor.modal_webhook.send_completion_callback') as mock_callback:
            
            # Mock processing failure
            mock_processor.side_effect = Exception("Video processing failed")
            
            result = await process_video_request(self.sample_webhook_request)
            
            # Should handle error and send failure callback
            assert result['status'] == 'failed'
            assert 'error' in result
            
            mock_callback.assert_called_once()
            callback_data = mock_callback.call_args[0][1]
            assert callback_data['status'] == 'failed'
            assert 'error' in callback_data

    async def test_webhook_cleans_up_temporary_files(self):
        """Test webhook cleans up all temporary files after processing."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        with patch('aidobe_video_processor.modal_webhook.cleanup_temp_files') as mock_cleanup, \
             patch('aidobe_video_processor.modal_webhook.VideoProcessor'):
            
            result = await process_video_request(self.sample_webhook_request)
            
            # Should clean up temporary files
            mock_cleanup.assert_called_once()

    async def test_webhook_reports_processing_progress(self):
        """Test webhook reports processing progress for long-running jobs."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        with patch('aidobe_video_processor.modal_webhook.send_progress_update') as mock_progress, \
             patch('aidobe_video_processor.modal_webhook.VideoProcessor'):
            
            result = await process_video_request(self.sample_webhook_request)
            
            # Should send progress updates during processing
            assert mock_progress.call_count >= 3  # At least 3 progress updates
            
            # Verify progress stages
            progress_calls = [call[0][1] for call in mock_progress.call_args_list]  # Extract progress values
            assert any(p['stage'] == 'downloading' for p in progress_calls)
            assert any(p['stage'] == 'processing' for p in progress_calls)
            assert any(p['stage'] == 'uploading' for p in progress_calls)

    async def test_webhook_validates_asset_availability(self):
        """Test webhook validates all assets are accessible before processing."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        with patch('aidobe_video_processor.modal_webhook.validate_asset_accessibility') as mock_validate:
            
            # Mock asset validation failure
            mock_validate.return_value = {
                'is_valid': False,
                'missing_assets': ['https://storage.example.com/video/missing.mp4'],
                'inaccessible_assets': ['https://storage.example.com/audio/protected.mp3']
            }
            
            with pytest.raises(ValueError) as excinfo:
                await process_video_request(self.sample_webhook_request)
            
            assert "Assets not accessible" in str(excinfo.value)
            mock_validate.assert_called_once()

    async def test_webhook_handles_different_video_formats(self):
        """Test webhook handles different input video formats (mp4, mov, avi)."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        # Modify request to use different video formats
        mixed_format_request = self.sample_webhook_request.copy()
        mixed_format_request['video_request']['video_assets'] = [
            {"asset_url": "https://storage.example.com/video/intro.mp4", "start_time": 0.0, "duration": 5.5},
            {"asset_url": "https://storage.example.com/video/demo.mov", "start_time": 5.5, "duration": 6.5},
            {"asset_url": "https://storage.example.com/video/outro.avi", "start_time": 12.0, "duration": 3.0}
        ]
        
        with patch('aidobe_video_processor.modal_webhook.VideoProcessor') as mock_processor:
            mock_processor.return_value.process_complete_video.return_value = {
                'status': 'success',
                'output_url': 'https://storage.example.com/output/test-job-12345.mp4'
            }
            
            result = await process_video_request(mixed_format_request)
            
            # Should handle different video formats successfully
            assert result['status'] == 'success'

    async def test_webhook_respects_memory_limits(self):
        """Test webhook processes large videos within memory constraints."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        # Create request with many video assets to test memory optimization
        large_request = self.sample_webhook_request.copy()
        large_request['video_request']['video_assets'] = [
            {"asset_url": f"https://storage.example.com/video/clip_{i}.mp4", "start_time": i*2.0, "duration": 2.0}
            for i in range(20)  # 20 video clips
        ]
        
        with patch('aidobe_video_processor.modal_webhook.VideoAssembler') as mock_assembler, \
             patch('aidobe_video_processor.modal_webhook.VideoProcessor'):
            
            mock_assembler_instance = mock_assembler.return_value
            
            result = await process_video_request(large_request)
            
            # Should use memory-optimized assembly
            mock_assembler_instance.assemble_video_optimized.assert_called_once()

    async def test_webhook_generates_comprehensive_metadata(self):
        """Test webhook generates comprehensive metadata about the processed video."""
        from aidobe_video_processor.modal_webhook import process_video_request
        
        with patch('aidobe_video_processor.modal_webhook.VideoProcessor') as mock_processor:
            mock_processor.return_value.process_complete_video.return_value = {
                'status': 'success',
                'output_url': 'https://storage.example.com/output/test-job-12345.mp4',
                'metadata': {
                    'duration': 15.0,
                    'resolution': (1920, 1080),
                    'fps': 30,
                    'file_size': 45600000,
                    'codec': 'libx264',
                    'bitrate': '2000k',
                    'audio_channels': 2,
                    'audio_sample_rate': 44100
                }
            }
            
            result = await process_video_request(self.sample_webhook_request)
            
            # Should return comprehensive metadata
            assert 'metadata' in result
            metadata = result['metadata']
            assert metadata['duration'] == 15.0
            assert metadata['resolution'] == (1920, 1080)
            assert metadata['fps'] == 30
            assert 'file_size' in metadata