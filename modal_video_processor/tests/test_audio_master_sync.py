"""
Test cases for AudioMasterSync

Following TDD approach - these tests will fail initially and drive the implementation.
Based on wanx patterns for audio-first video generation where audio duration rules.
"""

import pytest
from unittest.mock import Mock, patch, MagicMock
from aidobe_video_processor.audio_master_sync import AudioMasterSync


class TestAudioMasterSync:
    """Test AudioMasterSync for enforcing audio-first video generation."""

    def setup_method(self):
        """Setup test fixtures."""
        self.sync = AudioMasterSync()

    def test_force_video_duration_to_match_audio(self):
        """Test forcing video duration to exactly match audio duration."""
        audio_duration = 45.678
        
        # Mock video clip
        mock_video_clip = Mock()
        mock_video_clip.duration = 50.0  # Longer than audio
        
        synced_clip = self.sync.sync_video_to_audio_duration(mock_video_clip, audio_duration)
        
        # Video should be forced to audio duration
        mock_video_clip.set_duration.assert_called_once_with(audio_duration)
        assert synced_clip == mock_video_clip.set_duration.return_value

    def test_extend_short_video_to_match_audio(self):
        """Test extending short video to match longer audio duration."""
        audio_duration = 60.0
        
        # Mock short video clip
        mock_video_clip = Mock()
        mock_video_clip.duration = 30.0  # Shorter than audio
        
        synced_clip = self.sync.sync_video_to_audio_duration(
            mock_video_clip, 
            audio_duration,
            extend_strategy='loop'
        )
        
        # Video should be looped to match audio duration
        mock_video_clip.loop.assert_called_once_with(duration=audio_duration)
        assert synced_clip == mock_video_clip.loop.return_value

    def test_trim_long_video_to_match_audio(self):
        """Test trimming long video to match shorter audio duration."""
        audio_duration = 30.0
        
        # Mock long video clip
        mock_video_clip = Mock()
        mock_video_clip.duration = 60.0  # Longer than audio
        
        synced_clip = self.sync.sync_video_to_audio_duration(
            mock_video_clip, 
            audio_duration,
            trim_strategy='from_start'
        )
        
        # Video should be subclipped to audio duration
        mock_video_clip.subclip.assert_called_once_with(0, audio_duration)
        assert synced_clip == mock_video_clip.subclip.return_value

    def test_sync_multiple_video_scenes_to_audio_segments(self):
        """Test syncing multiple video scenes to audio segment durations."""
        audio_segments = [
            {'start_time': 0.0, 'end_time': 15.5, 'duration': 15.5},
            {'start_time': 15.5, 'end_time': 32.25, 'duration': 16.75},
            {'start_time': 32.25, 'end_time': 45.0, 'duration': 12.75}
        ]
        
        # Mock video clips
        mock_clips = [Mock(), Mock(), Mock()]
        for i, clip in enumerate(mock_clips):
            clip.duration = 20.0  # All clips longer than needed
        
        synced_clips = self.sync.sync_video_scenes_to_audio_segments(mock_clips, audio_segments)
        
        # Each clip should be synced to its corresponding audio segment
        assert len(synced_clips) == 3
        mock_clips[0].set_duration.assert_called_once_with(15.5)
        mock_clips[1].set_duration.assert_called_once_with(16.75)
        mock_clips[2].set_duration.assert_called_once_with(12.75)

    def test_audio_priority_over_visual_preferences(self):
        """Test that audio timing always takes priority over visual preferences."""
        audio_duration = 42.123
        preferred_video_duration = 60.0  # User preference
        
        mock_video_clip = Mock()
        mock_video_clip.duration = preferred_video_duration
        
        # Audio should override visual preference
        synced_clip = self.sync.enforce_audio_priority(
            mock_video_clip, 
            audio_duration, 
            visual_preference_duration=preferred_video_duration
        )
        
        # Audio duration should win
        mock_video_clip.set_duration.assert_called_once_with(audio_duration)
        assert synced_clip == mock_video_clip.set_duration.return_value

    def test_precise_millisecond_audio_sync(self):
        """Test precise audio synchronization to millisecond accuracy."""
        audio_duration = 123.456789  # Very precise audio duration
        
        mock_video_clip = Mock()
        mock_video_clip.duration = 120.0
        
        synced_clip = self.sync.sync_video_to_audio_duration(
            mock_video_clip, 
            audio_duration,
            precision='millisecond'
        )
        
        # Should preserve audio precision
        mock_video_clip.set_duration.assert_called_once_with(audio_duration)
        assert synced_clip == mock_video_clip.set_duration.return_value

    def test_handle_zero_duration_audio(self):
        """Test handling of zero or very short audio duration."""
        audio_duration = 0.0
        
        mock_video_clip = Mock()
        mock_video_clip.duration = 10.0
        
        with pytest.raises(ValueError) as excinfo:
            self.sync.sync_video_to_audio_duration(mock_video_clip, audio_duration)
        
        assert "Audio duration must be positive" in str(excinfo.value)

    def test_handle_negative_audio_duration(self):
        """Test handling of negative audio duration."""
        audio_duration = -5.0
        
        mock_video_clip = Mock()
        mock_video_clip.duration = 10.0
        
        with pytest.raises(ValueError) as excinfo:
            self.sync.sync_video_to_audio_duration(mock_video_clip, audio_duration)
        
        assert "Audio duration must be positive" in str(excinfo.value)

    def test_sync_with_audio_fade_margins(self):
        """Test syncing with audio fade in/out margins."""
        audio_duration = 30.0
        fade_in_duration = 1.0
        fade_out_duration = 2.0
        
        mock_video_clip = Mock()
        mock_video_clip.duration = 25.0
        
        synced_clip = self.sync.sync_video_to_audio_duration(
            mock_video_clip, 
            audio_duration,
            fade_in_margin=fade_in_duration,
            fade_out_margin=fade_out_duration
        )
        
        # Video should match full audio duration including fades
        expected_duration = audio_duration + fade_in_duration + fade_out_duration
        mock_video_clip.set_duration.assert_called_once_with(expected_duration)

    def test_batch_sync_video_clips_to_audio_timeline(self):
        """Test batch synchronization of video clips to audio timeline."""
        audio_timeline = [
            {'clip_id': 'scene1', 'start_time': 0.0, 'duration': 10.5},
            {'clip_id': 'scene2', 'start_time': 10.5, 'duration': 15.75},
            {'clip_id': 'scene3', 'start_time': 26.25, 'duration': 8.25}
        ]
        
        mock_clips = {
            'scene1': Mock(),
            'scene2': Mock(),
            'scene3': Mock()
        }
        
        for clip in mock_clips.values():
            clip.duration = 20.0  # All clips longer than needed
        
        synced_clips = self.sync.batch_sync_to_audio_timeline(mock_clips, audio_timeline)
        
        # All clips should be synced to their audio durations
        assert len(synced_clips) == 3
        mock_clips['scene1'].set_duration.assert_called_once_with(10.5)
        mock_clips['scene2'].set_duration.assert_called_once_with(15.75)
        mock_clips['scene3'].set_duration.assert_called_once_with(8.25)

    def test_sync_preserves_video_quality_settings(self):
        """Test that audio sync preserves original video quality settings."""
        audio_duration = 25.0
        
        mock_video_clip = Mock()
        mock_video_clip.duration = 30.0
        mock_video_clip.fps = 30
        mock_video_clip.size = (1920, 1080)
        
        synced_clip = self.sync.sync_video_to_audio_duration(
            mock_video_clip, 
            audio_duration,
            preserve_quality=True
        )
        
        # Quality settings should be preserved
        mock_video_clip.set_duration.assert_called_once_with(audio_duration)
        # Original clip properties should remain accessible
        assert synced_clip == mock_video_clip.set_duration.return_value

    def test_handle_corrupted_video_clip(self):
        """Test handling of corrupted or invalid video clip."""
        audio_duration = 30.0
        
        # Mock corrupted clip that raises exception
        mock_video_clip = Mock()
        mock_video_clip.set_duration.side_effect = Exception("Corrupted video")
        
        with pytest.raises(Exception) as excinfo:
            self.sync.sync_video_to_audio_duration(mock_video_clip, audio_duration)
        
        assert "Corrupted video" in str(excinfo.value)

    def test_audio_sync_with_speed_adjustment(self):
        """Test audio sync with video speed adjustment to fit duration."""
        audio_duration = 20.0
        
        mock_video_clip = Mock()
        mock_video_clip.duration = 40.0  # Twice as long as needed
        
        synced_clip = self.sync.sync_video_to_audio_duration(
            mock_video_clip, 
            audio_duration,
            adjust_speed=True
        )
        
        # Video should be sped up by 2x to match audio duration
        expected_speed_factor = mock_video_clip.duration / audio_duration
        mock_video_clip.fx.assert_called_once()
        # Should use speedx effect with calculated factor
        assert synced_clip == mock_video_clip.fx.return_value

    def test_sync_respects_minimum_video_duration(self):
        """Test that sync respects minimum video duration constraints."""
        audio_duration = 0.5  # Very short audio
        min_video_duration = 2.0
        
        mock_video_clip = Mock()
        mock_video_clip.duration = 10.0
        
        synced_clip = self.sync.sync_video_to_audio_duration(
            mock_video_clip, 
            audio_duration,
            min_video_duration=min_video_duration
        )
        
        # Should use minimum duration, not audio duration
        mock_video_clip.set_duration.assert_called_once_with(min_video_duration)

    def test_sync_with_audio_crossfade_regions(self):
        """Test syncing with audio crossfade regions between clips."""
        audio_segments = [
            {'start_time': 0.0, 'end_time': 15.0, 'duration': 15.0, 'crossfade_out': 1.0},
            {'start_time': 14.0, 'end_time': 30.0, 'duration': 16.0, 'crossfade_in': 1.0}
        ]
        
        mock_clips = [Mock(), Mock()]
        for clip in mock_clips:
            clip.duration = 20.0
        
        synced_clips = self.sync.sync_video_scenes_to_audio_segments(
            mock_clips, 
            audio_segments,
            handle_crossfades=True
        )
        
        # Clips should account for crossfade regions
        assert len(synced_clips) == 2
        # First clip should include crossfade region
        mock_clips[0].set_duration.assert_called_once_with(15.0)
        mock_clips[1].set_duration.assert_called_once_with(16.0)

    def test_audio_master_sync_integration(self):
        """Test complete audio-master sync workflow integration."""
        master_audio_duration = 65.432
        video_scenes = [Mock(), Mock(), Mock()]
        
        # Mock scene durations from audio analysis
        audio_scene_durations = [20.144, 25.678, 19.610]
        
        for i, clip in enumerate(video_scenes):
            clip.duration = 30.0  # All clips longer than needed
        
        synced_scenes = self.sync.sync_complete_video_to_master_audio(
            video_scenes, 
            master_audio_duration,
            scene_durations=audio_scene_durations
        )
        
        # All scenes should be synced to their audio durations
        assert len(synced_scenes) == 3
        video_scenes[0].set_duration.assert_called_once_with(20.144)
        video_scenes[1].set_duration.assert_called_once_with(25.678)
        video_scenes[2].set_duration.assert_called_once_with(19.610)
        
        # Total should match master audio duration
        total_synced_duration = sum(audio_scene_durations)
        assert abs(total_synced_duration - master_audio_duration) < 0.001