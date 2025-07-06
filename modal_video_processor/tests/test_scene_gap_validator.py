"""
Test cases for SceneGapValidator

Following TDD approach - these tests will fail initially and drive the implementation.
Based on wanx patterns for ensuring continuous video with no gaps or overlaps.
"""

import pytest
from aidobe_video_processor.scene_gap_validator import SceneGapValidator


class TestSceneGapValidator:
    """Test SceneGapValidator for continuous scene timing validation."""

    def setup_method(self):
        """Setup test fixtures."""
        self.validator = SceneGapValidator()

    def test_perfect_scene_continuity(self):
        """Test validation of perfectly continuous scenes."""
        scenes = [
            {'start_time': 0.0, 'end_time': 10.0, 'duration': 10.0},
            {'start_time': 10.0, 'end_time': 25.0, 'duration': 15.0},
            {'start_time': 25.0, 'end_time': 40.0, 'duration': 15.0}
        ]
        
        result = self.validator.validate_scene_continuity(scenes)
        
        assert result['is_valid'] == True
        assert result['gaps'] == []
        assert result['overlaps'] == []
        assert result['total_duration'] == 40.0

    def test_gap_detection_between_scenes(self):
        """Test detection of gaps between scenes."""
        scenes = [
            {'start_time': 0.0, 'end_time': 10.0, 'duration': 10.0},
            {'start_time': 12.0, 'end_time': 27.0, 'duration': 15.0},  # 2-second gap
            {'start_time': 30.0, 'end_time': 45.0, 'duration': 15.0}   # 3-second gap
        ]
        
        result = self.validator.validate_scene_continuity(scenes)
        
        assert result['is_valid'] == False
        assert len(result['gaps']) == 2
        
        # Check first gap
        gap1 = result['gaps'][0]
        assert gap1['after_scene'] == 0
        assert gap1['gap_start'] == 10.0
        assert gap1['gap_end'] == 12.0
        assert gap1['gap_duration'] == 2.0
        
        # Check second gap
        gap2 = result['gaps'][1]
        assert gap2['after_scene'] == 1
        assert gap2['gap_start'] == 27.0
        assert gap2['gap_end'] == 30.0
        assert gap2['gap_duration'] == 3.0

    def test_overlap_detection_between_scenes(self):
        """Test detection of overlaps between scenes."""
        scenes = [
            {'start_time': 0.0, 'end_time': 12.0, 'duration': 12.0},
            {'start_time': 10.0, 'end_time': 25.0, 'duration': 15.0},  # 2-second overlap
            {'start_time': 23.0, 'end_time': 38.0, 'duration': 15.0}   # 2-second overlap
        ]
        
        result = self.validator.validate_scene_continuity(scenes)
        
        assert result['is_valid'] == False
        assert len(result['overlaps']) == 2
        
        # Check first overlap
        overlap1 = result['overlaps'][0]
        assert overlap1['scene1'] == 0
        assert overlap1['scene2'] == 1
        assert overlap1['overlap_start'] == 10.0
        assert overlap1['overlap_end'] == 12.0
        assert overlap1['overlap_duration'] == 2.0
        
        # Check second overlap
        overlap2 = result['overlaps'][1]
        assert overlap2['scene1'] == 1
        assert overlap2['scene2'] == 2
        assert overlap2['overlap_start'] == 23.0
        assert overlap2['overlap_end'] == 25.0
        assert overlap2['overlap_duration'] == 2.0

    def test_fix_gaps_by_extending_scenes(self):
        """Test fixing gaps by extending previous scenes."""
        scenes = [
            {'start_time': 0.0, 'end_time': 10.0, 'duration': 10.0},
            {'start_time': 12.0, 'end_time': 27.0, 'duration': 15.0},  # 2-second gap
            {'start_time': 30.0, 'end_time': 45.0, 'duration': 15.0}   # 3-second gap
        ]
        
        fixed_scenes = self.validator.fix_gaps_extend_previous(scenes)
        
        # First scene should be extended to fill gap
        assert fixed_scenes[0]['end_time'] == 12.0
        assert fixed_scenes[0]['duration'] == 12.0
        
        # Second scene should be extended to fill gap
        assert fixed_scenes[1]['end_time'] == 30.0
        assert fixed_scenes[1]['duration'] == 18.0  # 15 + 3
        
        # Third scene unchanged
        assert fixed_scenes[2]['start_time'] == 30.0
        assert fixed_scenes[2]['end_time'] == 45.0
        
        # Verify continuity
        validation = self.validator.validate_scene_continuity(fixed_scenes)
        assert validation['is_valid'] == True

    def test_fix_gaps_by_shifting_scenes(self):
        """Test fixing gaps by shifting subsequent scenes earlier."""
        scenes = [
            {'start_time': 0.0, 'end_time': 10.0, 'duration': 10.0},
            {'start_time': 12.0, 'end_time': 27.0, 'duration': 15.0},  # 2-second gap
            {'start_time': 30.0, 'end_time': 45.0, 'duration': 15.0}   # 3-second gap
        ]
        
        fixed_scenes = self.validator.fix_gaps_shift_following(scenes)
        
        # First scene unchanged
        assert fixed_scenes[0]['start_time'] == 0.0
        assert fixed_scenes[0]['end_time'] == 10.0
        
        # Second scene shifted to start at 10.0
        assert fixed_scenes[1]['start_time'] == 10.0
        assert fixed_scenes[1]['end_time'] == 25.0
        assert fixed_scenes[1]['duration'] == 15.0
        
        # Third scene shifted to start at 25.0
        assert fixed_scenes[2]['start_time'] == 25.0
        assert fixed_scenes[2]['end_time'] == 40.0
        assert fixed_scenes[2]['duration'] == 15.0
        
        # Verify continuity
        validation = self.validator.validate_scene_continuity(fixed_scenes)
        assert validation['is_valid'] == True

    def test_fix_overlaps_by_trimming(self):
        """Test fixing overlaps by trimming earlier scenes."""
        scenes = [
            {'start_time': 0.0, 'end_time': 12.0, 'duration': 12.0},
            {'start_time': 10.0, 'end_time': 25.0, 'duration': 15.0},  # 2-second overlap
            {'start_time': 23.0, 'end_time': 38.0, 'duration': 15.0}   # 2-second overlap
        ]
        
        fixed_scenes = self.validator.fix_overlaps_trim_previous(scenes)
        
        # First scene trimmed to end at 10.0
        assert fixed_scenes[0]['start_time'] == 0.0
        assert fixed_scenes[0]['end_time'] == 10.0
        assert fixed_scenes[0]['duration'] == 10.0
        
        # Second scene trimmed to end at 23.0
        assert fixed_scenes[1]['start_time'] == 10.0
        assert fixed_scenes[1]['end_time'] == 23.0
        assert fixed_scenes[1]['duration'] == 13.0
        
        # Third scene unchanged
        assert fixed_scenes[2]['start_time'] == 23.0
        assert fixed_scenes[2]['end_time'] == 38.0
        assert fixed_scenes[2]['duration'] == 15.0
        
        # Verify continuity
        validation = self.validator.validate_scene_continuity(fixed_scenes)
        assert validation['is_valid'] == True

    def test_minimum_scene_duration_constraint(self):
        """Test that scene fixes respect minimum duration constraints."""
        scenes = [
            {'start_time': 0.0, 'end_time': 5.0, 'duration': 5.0},
            {'start_time': 10.0, 'end_time': 15.0, 'duration': 5.0}  # 5-second gap
        ]
        
        min_duration = 3.0
        fixed_scenes = self.validator.fix_gaps_extend_previous(
            scenes, 
            min_scene_duration=min_duration
        )
        
        # All scenes should meet minimum duration
        for scene in fixed_scenes:
            assert scene['duration'] >= min_duration

    def test_precision_preservation_in_fixes(self):
        """Test that gap fixes preserve millisecond precision."""
        scenes = [
            {'start_time': 0.0, 'end_time': 10.123, 'duration': 10.123},
            {'start_time': 10.456, 'end_time': 25.789, 'duration': 15.333}  # Small gap
        ]
        
        fixed_scenes = self.validator.fix_gaps_extend_previous(scenes)
        
        # Check precision preservation
        assert abs(fixed_scenes[0]['end_time'] - 10.456) < 0.001
        assert abs(fixed_scenes[1]['start_time'] - 10.456) < 0.001
        
        # Verify continuity
        validation = self.validator.validate_scene_continuity(fixed_scenes)
        assert validation['is_valid'] == True

    def test_complex_mixed_issues_fix(self):
        """Test fixing scenes with both gaps and overlaps."""
        scenes = [
            {'start_time': 0.0, 'end_time': 12.0, 'duration': 12.0},   # Overlaps with next
            {'start_time': 10.0, 'end_time': 20.0, 'duration': 10.0},  # Overlaps with prev
            {'start_time': 25.0, 'end_time': 35.0, 'duration': 10.0},  # Gap from prev
            {'start_time': 33.0, 'end_time': 43.0, 'duration': 10.0}   # Overlaps with prev
        ]
        
        # Fix overlaps first, then gaps
        fixed_scenes = self.validator.fix_all_timing_issues(scenes)
        
        # Verify final result is continuous
        validation = self.validator.validate_scene_continuity(fixed_scenes)
        assert validation['is_valid'] == True
        
        # Verify no gaps or overlaps remain
        assert len(validation['gaps']) == 0
        assert len(validation['overlaps']) == 0

    def test_empty_scenes_handling(self):
        """Test handling of empty scene list."""
        scenes = []
        
        result = self.validator.validate_scene_continuity(scenes)
        
        assert result['is_valid'] == True
        assert result['gaps'] == []
        assert result['overlaps'] == []
        assert result['total_duration'] == 0.0

    def test_single_scene_validation(self):
        """Test validation of single scene."""
        scenes = [
            {'start_time': 0.0, 'end_time': 10.0, 'duration': 10.0}
        ]
        
        result = self.validator.validate_scene_continuity(scenes)
        
        assert result['is_valid'] == True
        assert result['gaps'] == []
        assert result['overlaps'] == []
        assert result['total_duration'] == 10.0

    def test_invalid_scene_data_handling(self):
        """Test handling of invalid scene data."""
        scenes = [
            {'start_time': 10.0, 'end_time': 5.0, 'duration': -5.0},  # Invalid: end < start
            {'start_time': 5.0, 'end_time': 15.0, 'duration': 8.0}    # Invalid: duration mismatch
        ]
        
        with pytest.raises(ValueError) as excinfo:
            self.validator.validate_scene_continuity(scenes)
        
        assert "Scene 0" in str(excinfo.value)

    def test_very_small_gaps_tolerance(self):
        """Test tolerance for very small gaps (floating point precision)."""
        scenes = [
            {'start_time': 0.0, 'end_time': 10.0, 'duration': 10.0},
            {'start_time': 10.001, 'end_time': 25.0, 'duration': 14.999}  # 1ms gap
        ]
        
        # Should be considered valid with default tolerance
        result = self.validator.validate_scene_continuity(scenes, tolerance=0.01)
        
        assert result['is_valid'] == True
        assert len(result['gaps']) == 0

    def test_gap_filling_strategies_comparison(self):
        """Test different gap filling strategies and their results."""
        scenes = [
            {'start_time': 0.0, 'end_time': 10.0, 'duration': 10.0},
            {'start_time': 15.0, 'end_time': 30.0, 'duration': 15.0}  # 5-second gap
        ]
        
        # Strategy 1: Extend previous
        fixed_extend = self.validator.fix_gaps_extend_previous(scenes.copy())
        assert fixed_extend[0]['duration'] == 15.0  # Extended by 5 seconds
        
        # Strategy 2: Shift following
        fixed_shift = self.validator.fix_gaps_shift_following(scenes.copy())
        assert fixed_shift[1]['start_time'] == 10.0  # Shifted 5 seconds earlier
        
        # Both should result in valid continuity
        assert self.validator.validate_scene_continuity(fixed_extend)['is_valid']
        assert self.validator.validate_scene_continuity(fixed_shift)['is_valid']

    def test_audio_duration_enforcement(self):
        """Test enforcing total video duration to match audio duration."""
        scenes = [
            {'start_time': 0.0, 'end_time': 10.0, 'duration': 10.0},
            {'start_time': 10.0, 'end_time': 25.0, 'duration': 15.0},
            {'start_time': 25.0, 'end_time': 35.0, 'duration': 10.0}  # Total: 35 seconds
        ]
        
        target_audio_duration = 45.0  # Need 10 more seconds
        
        adjusted_scenes = self.validator.enforce_total_duration(scenes, target_audio_duration)
        
        # Total duration should match audio
        total_duration = sum(scene['duration'] for scene in adjusted_scenes)
        assert abs(total_duration - target_audio_duration) < 0.001
        
        # Should maintain continuity
        validation = self.validator.validate_scene_continuity(adjusted_scenes)
        assert validation['is_valid'] == True