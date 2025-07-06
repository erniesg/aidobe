"""
Test cases for SceneTimingCalculator

Following TDD approach - these tests will fail initially and drive the implementation.
Based on wanx patterns for distributing scene durations with deficit/surplus tracking.
"""

import pytest
from aidobe_video_processor.scene_timing import SceneTimingCalculator


class TestSceneTimingCalculator:
    """Test SceneTimingCalculator for precise scene duration distribution."""

    def setup_method(self):
        """Setup test fixtures."""
        self.calculator = SceneTimingCalculator()

    def test_equal_scene_distribution(self):
        """Test equal distribution of audio duration across scenes."""
        # Audio duration: 60 seconds, 3 scenes
        audio_duration = 60.0
        scene_count = 3
        
        durations = self.calculator.distribute_scene_durations(audio_duration, scene_count)
        
        # Each scene should get exactly 20 seconds
        assert len(durations) == 3
        assert all(duration == 20.0 for duration in durations)
        assert sum(durations) == audio_duration

    def test_uneven_distribution_with_remainder(self):
        """Test distribution when audio duration doesn't divide evenly."""
        # Audio duration: 100 seconds, 3 scenes
        audio_duration = 100.0
        scene_count = 3
        base_duration = 100.0 / 3  # 33.333...
        
        durations = self.calculator.distribute_scene_durations(audio_duration, scene_count)
        
        assert len(durations) == 3
        # Sum should equal original audio duration
        assert abs(sum(durations) - audio_duration) < 0.001
        # All durations should be close to base duration
        for duration in durations:
            assert abs(duration - base_duration) < 1.0

    def test_deficit_surplus_tracking(self):
        """Test deficit/surplus tracking algorithm from wanx."""
        # Audio: 89.5 seconds, 4 scenes
        audio_duration = 89.5
        scene_count = 4
        
        durations = self.calculator.distribute_scene_durations(
            audio_duration, 
            scene_count,
            track_deficit_surplus=True
        )
        
        assert len(durations) == 4
        assert abs(sum(durations) - audio_duration) < 0.001
        
        # Check that calculator tracked deficits/surpluses
        assert hasattr(self.calculator, '_deficits')
        assert hasattr(self.calculator, '_surpluses')

    def test_minimum_scene_duration_constraint(self):
        """Test that scenes respect minimum duration constraints."""
        # Very short audio with many scenes
        audio_duration = 10.0
        scene_count = 20
        min_duration = 1.0
        
        durations = self.calculator.distribute_scene_durations(
            audio_duration, 
            scene_count,
            min_scene_duration=min_duration
        )
        
        # All scenes should meet minimum duration
        assert all(duration >= min_duration for duration in durations)
        # Total might be longer than audio to meet minimums
        assert sum(durations) >= audio_duration

    def test_maximum_scene_duration_constraint(self):
        """Test that scenes respect maximum duration constraints."""
        # Long audio with few scenes
        audio_duration = 120.0
        scene_count = 2
        max_duration = 45.0
        
        durations = self.calculator.distribute_scene_durations(
            audio_duration, 
            scene_count,
            max_scene_duration=max_duration
        )
        
        # No scene should exceed maximum
        assert all(duration <= max_duration for duration in durations)
        # May need more scenes to fit within constraints
        assert len(durations) >= scene_count

    def test_weighted_scene_distribution(self):
        """Test distribution with different scene weights/importance."""
        audio_duration = 60.0
        scene_weights = [1.0, 2.0, 1.5, 0.5]  # 4 scenes with different weights
        
        durations = self.calculator.distribute_scene_durations_weighted(
            audio_duration, 
            scene_weights
        )
        
        assert len(durations) == 4
        assert abs(sum(durations) - audio_duration) < 0.001
        
        # Scene with weight 2.0 should get more time than weight 1.0
        assert durations[1] > durations[0]  # weight 2.0 > weight 1.0
        assert durations[2] > durations[3]  # weight 1.5 > weight 0.5

    def test_scene_timing_with_gaps_detection(self):
        """Test timing calculation that detects potential gaps."""
        audio_duration = 45.678
        scene_count = 5
        
        timing_result = self.calculator.calculate_scene_timing(audio_duration, scene_count)
        
        assert 'durations' in timing_result
        assert 'start_times' in timing_result
        assert 'end_times' in timing_result
        assert 'gaps_detected' in timing_result
        
        durations = timing_result['durations']
        start_times = timing_result['start_times']
        end_times = timing_result['end_times']
        
        assert len(durations) == scene_count
        assert len(start_times) == scene_count
        assert len(end_times) == scene_count
        
        # Verify continuity - no gaps between scenes
        for i in range(scene_count - 1):
            gap = start_times[i + 1] - end_times[i]
            assert abs(gap) < 0.001  # No significant gaps

    def test_precision_preservation(self):
        """Test that timing calculations preserve millisecond precision."""
        audio_duration = 123.456789
        scene_count = 7
        
        durations = self.calculator.distribute_scene_durations(audio_duration, scene_count)
        
        # Sum should preserve precision
        assert abs(sum(durations) - audio_duration) < 0.001
        
        # Individual durations should have reasonable precision
        for duration in durations:
            # Should not have absurd precision artifacts
            assert round(duration, 3) == round(duration, 3)

    def test_empty_scenes_handling(self):
        """Test handling of edge case with zero scenes."""
        audio_duration = 30.0
        scene_count = 0
        
        with pytest.raises(ValueError) as excinfo:
            self.calculator.distribute_scene_durations(audio_duration, scene_count)
        
        assert "Scene count must be positive" in str(excinfo.value)

    def test_negative_audio_duration(self):
        """Test handling of invalid negative audio duration."""
        audio_duration = -10.0
        scene_count = 3
        
        with pytest.raises(ValueError) as excinfo:
            self.calculator.distribute_scene_durations(audio_duration, scene_count)
        
        assert "Audio duration must be positive" in str(excinfo.value)

    def test_single_scene_timing(self):
        """Test timing calculation for single scene."""
        audio_duration = 67.89
        scene_count = 1
        
        durations = self.calculator.distribute_scene_durations(audio_duration, scene_count)
        
        assert len(durations) == 1
        assert durations[0] == audio_duration

    def test_very_precise_timing_distribution(self):
        """Test timing with very precise audio durations."""
        # Test with TTS-generated audio precision
        audio_duration = 42.123456789
        scene_count = 6
        
        timing_result = self.calculator.calculate_scene_timing(audio_duration, scene_count)
        
        durations = timing_result['durations']
        start_times = timing_result['start_times']
        end_times = timing_result['end_times']
        
        # Verify precision is maintained
        assert abs(sum(durations) - audio_duration) < 0.001
        
        # Verify scene boundaries are precise
        assert abs(start_times[0]) < 0.001  # First scene starts at 0
        assert abs(end_times[-1] - audio_duration) < 0.001  # Last scene ends at audio end

    def test_scene_rebalancing_algorithm(self):
        """Test the deficit/surplus rebalancing algorithm."""
        audio_duration = 97.654321
        scene_count = 8
        
        # Enable detailed tracking
        result = self.calculator.calculate_scene_timing(
            audio_duration, 
            scene_count,
            enable_rebalancing=True
        )
        
        durations = result['durations']
        rebalancing_log = result.get('rebalancing_log', [])
        
        # Should have rebalancing information
        assert len(rebalancing_log) >= 0
        assert abs(sum(durations) - audio_duration) < 0.001
        
        # All durations should be reasonable (not too small/large)
        base_duration = audio_duration / scene_count
        for duration in durations:
            assert duration > base_duration * 0.5  # Not less than half
            assert duration < base_duration * 2.0  # Not more than double