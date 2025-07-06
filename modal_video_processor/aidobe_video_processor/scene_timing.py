"""
SceneTimingCalculator

Distributes scene durations based on audio duration with deficit/surplus tracking.
Based on wanx patterns for precise video timing synchronization.
"""

from typing import List, Dict, Any, Optional
import math


class SceneTimingCalculator:
    """Calculate precise scene timing distribution based on audio duration."""

    def __init__(self):
        """Initialize the scene timing calculator."""
        self._deficits = []
        self._surpluses = []
        self._rebalancing_log = []

    def distribute_scene_durations(
        self, 
        audio_duration: float, 
        scene_count: int,
        min_scene_duration: Optional[float] = None,
        max_scene_duration: Optional[float] = None,
        track_deficit_surplus: bool = False
    ) -> List[float]:
        """
        Distribute audio duration evenly across scenes with constraints.
        
        Args:
            audio_duration: Total audio duration in seconds
            scene_count: Number of scenes to create
            min_scene_duration: Minimum duration per scene
            max_scene_duration: Maximum duration per scene
            track_deficit_surplus: Enable deficit/surplus tracking
            
        Returns:
            List of scene durations in seconds
            
        Raises:
            ValueError: If inputs are invalid
        """
        if audio_duration <= 0:
            raise ValueError("Audio duration must be positive")
        if scene_count <= 0:
            raise ValueError("Scene count must be positive")
        
        # Reset tracking if enabled
        if track_deficit_surplus:
            self._deficits = []
            self._surpluses = []
        
        # Calculate base duration per scene
        base_duration = audio_duration / scene_count
        
        # Handle constraints
        if min_scene_duration and base_duration < min_scene_duration:
            # Need more scenes to meet minimum duration
            adjusted_scene_count = math.ceil(audio_duration / min_scene_duration)
            return self._distribute_with_minimum_constraint(
                audio_duration, adjusted_scene_count, min_scene_duration
            )
        
        if max_scene_duration and base_duration > max_scene_duration:
            # Need more scenes to stay under maximum
            adjusted_scene_count = math.ceil(audio_duration / max_scene_duration)
            return self._distribute_with_maximum_constraint(
                audio_duration, adjusted_scene_count, max_scene_duration
            )
        
        # Standard distribution with deficit/surplus tracking
        return self._distribute_with_tracking(
            audio_duration, scene_count, track_deficit_surplus
        )

    def distribute_scene_durations_weighted(
        self, 
        audio_duration: float, 
        scene_weights: List[float]
    ) -> List[float]:
        """
        Distribute audio duration based on scene weights/importance.
        
        Args:
            audio_duration: Total audio duration in seconds
            scene_weights: List of weights for each scene
            
        Returns:
            List of scene durations in seconds
        """
        if audio_duration <= 0:
            raise ValueError("Audio duration must be positive")
        if not scene_weights or any(w <= 0 for w in scene_weights):
            raise ValueError("All scene weights must be positive")
        
        total_weight = sum(scene_weights)
        durations = []
        
        for weight in scene_weights:
            duration = (weight / total_weight) * audio_duration
            durations.append(duration)
        
        # Ensure exact total (handle floating point precision)
        actual_total = sum(durations)
        if abs(actual_total - audio_duration) > 0.001:
            # Adjust last scene to match exact total
            durations[-1] += (audio_duration - actual_total)
        
        return durations

    def calculate_scene_timing(
        self, 
        audio_duration: float, 
        scene_count: int,
        enable_rebalancing: bool = False
    ) -> Dict[str, Any]:
        """
        Calculate complete scene timing with start/end times and gap detection.
        
        Args:
            audio_duration: Total audio duration in seconds
            scene_count: Number of scenes
            enable_rebalancing: Enable deficit/surplus rebalancing
            
        Returns:
            Dictionary with timing information
        """
        durations = self.distribute_scene_durations(
            audio_duration, 
            scene_count,
            track_deficit_surplus=enable_rebalancing
        )
        
        # Calculate start and end times
        start_times = []
        end_times = []
        current_time = 0.0
        
        for duration in durations:
            start_times.append(current_time)
            current_time += duration
            end_times.append(current_time)
        
        # Check for gaps
        gaps_detected = []
        for i in range(len(start_times) - 1):
            gap = start_times[i + 1] - end_times[i]
            if abs(gap) > 0.001:  # Significant gap
                gaps_detected.append({
                    'after_scene': i,
                    'gap_duration': gap
                })
        
        result = {
            'durations': durations,
            'start_times': start_times,
            'end_times': end_times,
            'gaps_detected': gaps_detected,
            'total_duration': sum(durations)
        }
        
        if enable_rebalancing:
            result['rebalancing_log'] = self._rebalancing_log.copy()
        
        return result

    def _distribute_with_tracking(
        self, 
        audio_duration: float, 
        scene_count: int, 
        track_deficit_surplus: bool
    ) -> List[float]:
        """Distribute duration with deficit/surplus tracking algorithm."""
        base_duration = audio_duration / scene_count
        durations = []
        running_total = 0.0
        
        for i in range(scene_count):
            # Calculate ideal duration for this scene
            ideal_total = (i + 1) * base_duration
            scene_duration = ideal_total - running_total
            
            if track_deficit_surplus:
                deficit = max(0, base_duration - scene_duration)
                surplus = max(0, scene_duration - base_duration)
                
                if deficit > 0:
                    self._deficits.append({'scene': i, 'deficit': deficit})
                if surplus > 0:
                    self._surpluses.append({'scene': i, 'surplus': surplus})
            
            durations.append(scene_duration)
            running_total += scene_duration
        
        # Final adjustment for precision
        actual_total = sum(durations)
        if abs(actual_total - audio_duration) > 0.001:
            adjustment = audio_duration - actual_total
            durations[-1] += adjustment
        
        return durations

    def _distribute_with_minimum_constraint(
        self, 
        audio_duration: float, 
        scene_count: int, 
        min_duration: float
    ) -> List[float]:
        """Distribute with minimum duration constraint."""
        durations = [min_duration] * scene_count
        total_min = sum(durations)
        
        if total_min > audio_duration:
            # Need to extend total duration to meet minimums
            return durations
        
        # Distribute remaining time
        remaining = audio_duration - total_min
        bonus_per_scene = remaining / scene_count
        
        return [duration + bonus_per_scene for duration in durations]

    def _distribute_with_maximum_constraint(
        self, 
        audio_duration: float, 
        scene_count: int, 
        max_duration: float
    ) -> List[float]:
        """Distribute with maximum duration constraint."""
        base_duration = audio_duration / scene_count
        
        if base_duration <= max_duration:
            # No adjustment needed
            return self._distribute_with_tracking(audio_duration, scene_count, False)
        
        # Cap scenes at maximum and distribute remaining
        durations = [max_duration] * scene_count
        total_capped = sum(durations)
        
        if total_capped < audio_duration:
            # Add more scenes for remaining duration
            remaining = audio_duration - total_capped
            additional_scenes = math.ceil(remaining / max_duration)
            
            for _ in range(additional_scenes):
                scene_duration = min(remaining, max_duration)
                durations.append(scene_duration)
                remaining -= scene_duration
                
                if remaining <= 0:
                    break
        
        return durations

    def get_deficit_surplus_summary(self) -> Dict[str, Any]:
        """Get summary of deficit/surplus tracking."""
        return {
            'deficits': self._deficits.copy(),
            'surpluses': self._surpluses.copy(),
            'total_deficit': sum(d['deficit'] for d in self._deficits),
            'total_surplus': sum(s['surplus'] for s in self._surpluses),
            'rebalancing_log': self._rebalancing_log.copy()
        }

    def clear_tracking(self):
        """Clear deficit/surplus tracking data."""
        self._deficits.clear()
        self._surpluses.clear()
        self._rebalancing_log.clear()