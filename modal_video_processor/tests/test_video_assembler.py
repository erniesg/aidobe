"""
Test cases for VideoAssembler

Following TDD approach - these tests will fail initially and drive the implementation.
Based on wanx patterns for complete video assembly pipeline with MoviePy CompositeVideoClip.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from aidobe_video_processor.video_assembler import VideoAssembler


class TestVideoAssembler:
    """Test VideoAssembler for complete video assembly pipeline."""

    def setup_method(self):
        """Setup test fixtures."""
        self.assembler = VideoAssembler()

    @patch('aidobe_video_processor.video_assembler.concatenate_videoclips')
    @patch('aidobe_video_processor.video_assembler.CompositeVideoClip')
    def test_assemble_basic_video_with_audio(self, mock_composite, mock_concatenate):
        """Test basic video assembly with synchronized audio."""
        # Mock components
        mock_video_clips = [Mock(), Mock(), Mock()]
        mock_audio_clip = Mock()
        mock_audio_clip.duration = 45.0
        
        # Configure video clip durations
        for i, clip in enumerate(mock_video_clips):
            clip.duration = 15.0
        
        # Mock MoviePy functions
        mock_final_video = Mock()
        mock_concatenate.return_value = mock_final_video
        mock_final_video.set_audio.return_value = mock_final_video
        
        assembled_video = self.assembler.assemble_video(
            video_clips=mock_video_clips,
            audio_clip=mock_audio_clip,
            output_config={'resolution': '1080p', 'fps': 30}
        )
        
        # Should create composite video with audio
        assert assembled_video is not None
        # Audio should be set to the provided audio clip
        mock_final_video.set_audio.assert_called_once_with(mock_audio_clip)

    def test_assemble_video_with_scene_timing_integration(self):
        """Test video assembly with SceneTimingCalculator integration."""
        mock_video_clips = [Mock(), Mock()]
        mock_audio_clip = Mock()
        mock_audio_clip.duration = 30.0
        
        # Mock scene timing calculator
        with patch('aidobe_video_processor.video_assembler.SceneTimingCalculator') as mock_timing_calc:
            mock_timing_instance = mock_timing_calc.return_value
            mock_timing_instance.distribute_scene_durations.return_value = [15.0, 15.0]
            
            assembled_video = self.assembler.assemble_video_with_timing(
                video_clips=mock_video_clips,
                audio_clip=mock_audio_clip,
                use_scene_timing=True
            )
            
            # Should use scene timing calculator
            mock_timing_instance.distribute_scene_durations.assert_called_once_with(30.0, 2)

    def test_assemble_video_with_gap_validation(self):
        """Test video assembly with SceneGapValidator integration."""
        mock_video_clips = [Mock(), Mock()]
        mock_audio_clip = Mock()
        mock_audio_clip.duration = 30.0
        
        # Mock gap validator
        with patch('aidobe_video_processor.video_assembler.SceneGapValidator') as mock_gap_validator:
            mock_validator_instance = mock_gap_validator.return_value
            mock_validator_instance.validate_scene_continuity.return_value = {
                'is_valid': False,
                'gaps': [{'after_scene': 0, 'gap_duration': 2.0}]
            }
            mock_validator_instance.fix_all_timing_issues.return_value = mock_video_clips
            
            assembled_video = self.assembler.assemble_video_with_validation(
                video_clips=mock_video_clips,
                audio_clip=mock_audio_clip,
                fix_gaps=True
            )
            
            # Should validate and fix gaps
            mock_validator_instance.validate_scene_continuity.assert_called_once()
            mock_validator_instance.fix_all_timing_issues.assert_called_once()

    def test_assemble_video_with_audio_master_sync(self):
        """Test video assembly with AudioMasterSync integration."""
        mock_video_clips = [Mock(), Mock()]
        mock_audio_clip = Mock()
        mock_audio_clip.duration = 30.0
        
        # Mock audio master sync
        with patch('aidobe_video_processor.video_assembler.AudioMasterSync') as mock_audio_sync:
            mock_sync_instance = mock_audio_sync.return_value
            mock_sync_instance.sync_complete_video_to_master_audio.return_value = mock_video_clips
            
            assembled_video = self.assembler.assemble_video_with_audio_sync(
                video_clips=mock_video_clips,
                audio_clip=mock_audio_clip,
                enforce_audio_priority=True
            )
            
            # Should sync video to audio
            mock_sync_instance.sync_complete_video_to_master_audio.assert_called_once()

    def test_assemble_video_with_effects_and_transitions(self):
        """Test video assembly with effects and transitions."""
        mock_video_clips = [Mock(), Mock()]
        mock_audio_clip = Mock()
        
        effects_config = {
            'transitions': [{'type': 'fade', 'duration': 1.0}],
            'effects': [{'type': 'ken_burns', 'enabled': True}]
        }
        
        assembled_video = self.assembler.assemble_video_with_effects(
            video_clips=mock_video_clips,
            audio_clip=mock_audio_clip,
            effects_config=effects_config
        )
        
        # Should apply effects and transitions
        assert assembled_video is not None

    def test_assemble_video_with_captions_overlay(self):
        """Test video assembly with caption overlays."""
        mock_video_clips = [Mock()]
        mock_audio_clip = Mock()
        
        captions_data = [
            {'text': 'Hello world', 'start_time': 0.0, 'end_time': 2.0},
            {'text': 'This is a test', 'start_time': 2.0, 'end_time': 5.0}
        ]
        
        assembled_video = self.assembler.assemble_video_with_captions(
            video_clips=mock_video_clips,
            audio_clip=mock_audio_clip,
            captions_data=captions_data,
            caption_style={'fontsize': 24, 'color': 'white'}
        )
        
        # Should create composite with captions
        assert assembled_video is not None

    def test_assemble_video_full_pipeline_integration(self):
        """Test complete video assembly pipeline with all components."""
        mock_video_clips = [Mock(), Mock(), Mock()]
        mock_audio_clip = Mock()
        mock_audio_clip.duration = 45.0
        
        # Configure mock clips
        for i, clip in enumerate(mock_video_clips):
            clip.duration = 15.0
        
        # Mock all integrated components
        with patch('aidobe_video_processor.video_assembler.SceneTimingCalculator') as mock_timing, \
             patch('aidobe_video_processor.video_assembler.SceneGapValidator') as mock_validator, \
             patch('aidobe_video_processor.video_assembler.AudioMasterSync') as mock_sync:
            
            # Configure mocks
            mock_timing.return_value.distribute_scene_durations.return_value = [15.0, 15.0, 15.0]
            mock_validator.return_value.validate_scene_continuity.return_value = {'is_valid': True}
            mock_sync.return_value.sync_complete_video_to_master_audio.return_value = mock_video_clips
            
            assembled_video = self.assembler.assemble_complete_video(
                video_clips=mock_video_clips,
                audio_clip=mock_audio_clip,
                captions_data=[],
                effects_config={},
                output_config={'resolution': '1080p', 'fps': 30}
            )
            
            # Should integrate all components
            assert assembled_video is not None
            mock_timing.assert_called_once()
            mock_validator.assert_called_once()
            mock_sync.assert_called_once()

    def test_assemble_video_with_background_music_mixing(self):
        """Test video assembly with background music mixing."""
        mock_video_clips = [Mock()]
        mock_main_audio = Mock()
        mock_background_music = Mock()
        
        mock_main_audio.duration = 30.0
        mock_background_music.duration = 60.0  # Longer than main audio
        
        assembled_video = self.assembler.assemble_video_with_background_music(
            video_clips=mock_video_clips,
            main_audio=mock_main_audio,
            background_music=mock_background_music,
            music_volume=0.08,  # Low volume for background
            fade_duration=2.0
        )
        
        # Should mix audio tracks
        assert assembled_video is not None

    def test_assemble_video_with_speed_adjustment(self):
        """Test video assembly with speed adjustment for timing."""
        mock_video_clips = [Mock()]
        mock_audio_clip = Mock()
        mock_audio_clip.duration = 20.0
        
        # Video is longer than audio
        mock_video_clips[0].duration = 30.0
        
        assembled_video = self.assembler.assemble_video_with_speed_adjustment(
            video_clips=mock_video_clips,
            audio_clip=mock_audio_clip,
            target_duration=20.0,
            preserve_pitch=True
        )
        
        # Should adjust video speed to match audio
        assert assembled_video is not None

    def test_export_video_with_quality_settings(self):
        """Test video export with quality and format settings."""
        mock_composite_video = Mock()
        
        export_config = {
            'format': 'mp4',
            'codec': 'libx264',
            'bitrate': '2000k',
            'fps': 30,
            'resolution': (1920, 1080)
        }
        
        output_path = self.assembler.export_video(
            composite_video=mock_composite_video,
            output_path='/tmp/test_video.mp4',
            export_config=export_config
        )
        
        # Should export with specified settings
        mock_composite_video.write_videofile.assert_called_once()
        assert output_path == '/tmp/test_video.mp4'

    def test_assemble_video_memory_optimization(self):
        """Test video assembly with memory optimization."""
        mock_video_clips = [Mock() for _ in range(10)]  # Many clips
        mock_audio_clip = Mock()
        
        assembled_video = self.assembler.assemble_video_optimized(
            video_clips=mock_video_clips,
            audio_clip=mock_audio_clip,
            chunk_size=3,  # Process in chunks
            cleanup_intermediate=True
        )
        
        # Should handle memory optimization
        assert assembled_video is not None

    def test_handle_video_assembly_errors(self):
        """Test error handling during video assembly."""
        mock_video_clips = [Mock()]
        mock_audio_clip = Mock()
        
        # Mock clip that raises exception during validation
        mock_video_clips[0].duration = None  # Invalid duration
        
        with pytest.raises(ValueError) as excinfo:
            self.assembler.assemble_video(
                video_clips=mock_video_clips,
                audio_clip=mock_audio_clip
            )
        
        assert "missing duration property" in str(excinfo.value).lower()

    def test_validate_assembly_inputs(self):
        """Test validation of assembly inputs."""
        # Test empty video clips
        with pytest.raises(ValueError) as excinfo:
            self.assembler.assemble_video(
                video_clips=[],
                audio_clip=Mock()
            )
        
        assert "Video clips cannot be empty" in str(excinfo.value)
        
        # Test None audio clip
        with pytest.raises(ValueError) as excinfo:
            self.assembler.assemble_video(
                video_clips=[Mock()],
                audio_clip=None
            )
        
        assert "Audio clip is required" in str(excinfo.value)

    @patch('aidobe_video_processor.video_assembler.concatenate_videoclips')
    def test_assemble_video_with_progress_callback(self, mock_concatenate):
        """Test video assembly with progress reporting."""
        mock_video_clips = [Mock(), Mock()]
        mock_audio_clip = Mock()
        mock_audio_clip.duration = 30.0  # Set duration for scene timing
        progress_callback = Mock()
        
        # Configure video clip durations
        for clip in mock_video_clips:
            clip.duration = 15.0
        
        # Mock the concatenate function
        mock_final_video = Mock()
        mock_concatenate.return_value = mock_final_video
        mock_final_video.set_audio.return_value = mock_final_video
        
        assembled_video = self.assembler.assemble_video_with_progress(
            video_clips=mock_video_clips,
            audio_clip=mock_audio_clip,
            progress_callback=progress_callback
        )
        
        # Should report progress during assembly
        assert progress_callback.call_count > 0
        assert assembled_video is not None

    def test_get_assembly_metadata(self):
        """Test retrieval of assembly metadata."""
        mock_video_clips = [Mock(), Mock()]
        mock_audio_clip = Mock()
        mock_audio_clip.duration = 30.0
        
        for clip in mock_video_clips:
            clip.duration = 15.0
            clip.fps = 30
            clip.size = (1920, 1080)
        
        metadata = self.assembler.get_assembly_metadata(
            video_clips=mock_video_clips,
            audio_clip=mock_audio_clip
        )
        
        # Should return comprehensive metadata
        assert metadata['total_video_duration'] == 30.0
        assert metadata['audio_duration'] == 30.0
        assert metadata['clip_count'] == 2
        assert metadata['resolution'] == (1920, 1080)
        assert metadata['fps'] == 30

    @patch('aidobe_video_processor.video_assembler.concatenate_videoclips')
    def test_preview_assembly_without_export(self, mock_concatenate):
        """Test creating preview of assembly without full export."""
        mock_video_clips = [Mock()]
        mock_audio_clip = Mock()
        mock_audio_clip.duration = 30.0  # Set duration
        
        # Configure video clip durations
        mock_video_clips[0].duration = 30.0
        mock_video_clips[0].subclip.return_value = mock_video_clips[0]
        mock_audio_clip.subclip.return_value = mock_audio_clip
        
        # Mock the concatenate function
        mock_final_video = Mock()
        mock_concatenate.return_value = mock_final_video
        mock_final_video.set_audio.return_value = mock_final_video
        mock_final_video.resize.return_value = mock_final_video
        
        preview_clip = self.assembler.create_preview(
            video_clips=mock_video_clips,
            audio_clip=mock_audio_clip,
            preview_duration=10.0,  # Short preview
            preview_quality='low'
        )
        
        # Should create low-quality preview
        assert preview_clip is not None