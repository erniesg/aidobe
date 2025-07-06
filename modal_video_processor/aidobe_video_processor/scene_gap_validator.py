"""
SceneGapValidator

Ensures continuous video with no gaps or overlaps between scenes.
Based on wanx patterns for seamless video assembly.
"""

from typing import List, Dict, Any, Optional
import copy


class SceneGapValidator:
    """Validate and fix scene timing to ensure continuous video playback."""

    def __init__(self, default_tolerance: float = 0.001):
        """
        Initialize the scene gap validator.
        
        Args:
            default_tolerance: Default tolerance for gap/overlap detection (seconds)
        """
        self.default_tolerance = default_tolerance

    def validate_scene_continuity(
        self, 
        scenes: List[Dict[str, float]], 
        tolerance: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Validate scene continuity and detect gaps/overlaps.
        
        Args:
            scenes: List of scene dictionaries with timing information
            tolerance: Tolerance for gap/overlap detection (uses default if None)
            
        Returns:
            Dictionary with validation results
            
        Raises:
            ValueError: If scene data is invalid
        """
        if tolerance is None:
            tolerance = self.default_tolerance
        
        # Validate scene data
        self._validate_scene_data(scenes)
        
        if not scenes:
            return {
                'is_valid': True,
                'gaps': [],
                'overlaps': [],
                'total_duration': 0.0,
                'message': 'No scenes to validate'
            }
        
        if len(scenes) == 1:
            return {
                'is_valid': True,
                'gaps': [],
                'overlaps': [],
                'total_duration': scenes[0]['duration'],
                'message': 'Single scene - no continuity issues possible'
            }
        
        gaps = []
        overlaps = []
        
        # Check continuity between adjacent scenes
        for i in range(len(scenes) - 1):
            current_scene = scenes[i]
            next_scene = scenes[i + 1]
            
            gap_duration = next_scene['start_time'] - current_scene['end_time']
            
            if gap_duration > tolerance:
                # Gap detected
                gaps.append({
                    'after_scene': i,
                    'gap_start': current_scene['end_time'],
                    'gap_end': next_scene['start_time'],
                    'gap_duration': gap_duration
                })
            elif gap_duration < -tolerance:
                # Overlap detected
                overlap_duration = abs(gap_duration)
                overlap_start = next_scene['start_time']
                overlap_end = current_scene['end_time']
                
                overlaps.append({
                    'scene1': i,
                    'scene2': i + 1,
                    'overlap_start': overlap_start,
                    'overlap_end': overlap_end,
                    'overlap_duration': overlap_duration
                })
        
        # Calculate total duration
        if scenes:
            total_duration = scenes[-1]['end_time'] - scenes[0]['start_time']
        else:
            total_duration = 0.0
        
        is_valid = len(gaps) == 0 and len(overlaps) == 0
        
        return {
            'is_valid': is_valid,
            'gaps': gaps,
            'overlaps': overlaps,
            'total_duration': total_duration,
            'message': 'Valid continuity' if is_valid else f'{len(gaps)} gaps, {len(overlaps)} overlaps detected'
        }

    def fix_gaps_extend_previous(
        self, 
        scenes: List[Dict[str, float]], 
        min_scene_duration: Optional[float] = None
    ) -> List[Dict[str, float]]:
        """
        Fix gaps by extending the duration of previous scenes.
        
        Args:
            scenes: List of scene dictionaries
            min_scene_duration: Minimum duration constraint for scenes
            
        Returns:
            List of fixed scene dictionaries
        """
        if not scenes:
            return scenes
        
        fixed_scenes = copy.deepcopy(scenes)
        
        for i in range(len(fixed_scenes) - 1):
            current_scene = fixed_scenes[i]
            next_scene = fixed_scenes[i + 1]
            
            gap_duration = next_scene['start_time'] - current_scene['end_time']
            
            if gap_duration > self.default_tolerance:
                # Extend current scene to fill gap
                current_scene['end_time'] = next_scene['start_time']
                current_scene['duration'] = current_scene['end_time'] - current_scene['start_time']
                
                # Check minimum duration constraint
                if min_scene_duration and current_scene['duration'] < min_scene_duration:
                    # Extend scene to meet minimum
                    extension_needed = min_scene_duration - current_scene['duration']
                    current_scene['end_time'] += extension_needed
                    current_scene['duration'] = min_scene_duration
                    
                    # Shift subsequent scenes to accommodate extension
                    for j in range(i + 1, len(fixed_scenes)):
                        shift_amount = extension_needed
                        fixed_scenes[j]['start_time'] += shift_amount
                        fixed_scenes[j]['end_time'] += shift_amount
        
        return fixed_scenes

    def fix_gaps_shift_following(self, scenes: List[Dict[str, float]]) -> List[Dict[str, float]]:
        """
        Fix gaps by shifting subsequent scenes earlier.
        
        Args:
            scenes: List of scene dictionaries
            
        Returns:
            List of fixed scene dictionaries
        """
        if not scenes:
            return scenes
        
        fixed_scenes = copy.deepcopy(scenes)
        
        # Process scenes sequentially, shifting each to eliminate gaps
        for i in range(1, len(fixed_scenes)):
            current_scene = fixed_scenes[i]
            previous_scene = fixed_scenes[i - 1]
            
            gap_duration = current_scene['start_time'] - previous_scene['end_time']
            
            if gap_duration > self.default_tolerance:
                # Shift current scene to start right after previous scene
                shift_amount = gap_duration
                current_scene['start_time'] -= shift_amount
                current_scene['end_time'] -= shift_amount
        
        return fixed_scenes

    def fix_overlaps_trim_previous(self, scenes: List[Dict[str, float]]) -> List[Dict[str, float]]:
        """
        Fix overlaps by trimming the end of previous scenes.
        
        Args:
            scenes: List of scene dictionaries
            
        Returns:
            List of fixed scene dictionaries
        """
        if not scenes:
            return scenes
        
        fixed_scenes = copy.deepcopy(scenes)
        
        for i in range(len(fixed_scenes) - 1):
            current_scene = fixed_scenes[i]
            next_scene = fixed_scenes[i + 1]
            
            if current_scene['end_time'] > next_scene['start_time']:
                # Overlap detected - trim current scene
                current_scene['end_time'] = next_scene['start_time']
                current_scene['duration'] = current_scene['end_time'] - current_scene['start_time']
                
                # Ensure duration is positive
                if current_scene['duration'] <= 0:
                    current_scene['duration'] = 0.1  # Minimum 100ms duration
                    current_scene['end_time'] = current_scene['start_time'] + current_scene['duration']
        
        return fixed_scenes

    def fix_all_timing_issues(
        self, 
        scenes: List[Dict[str, float]], 
        min_scene_duration: Optional[float] = None
    ) -> List[Dict[str, float]]:
        """
        Fix all timing issues (gaps and overlaps) in scenes.
        
        Args:
            scenes: List of scene dictionaries
            min_scene_duration: Minimum duration constraint for scenes
            
        Returns:
            List of fixed scene dictionaries
        """
        if not scenes:
            return scenes
        
        # Step 1: Fix overlaps first by trimming
        fixed_scenes = self.fix_overlaps_trim_previous(scenes)
        
        # Step 2: Fix gaps by extending previous scenes
        fixed_scenes = self.fix_gaps_extend_previous(fixed_scenes, min_scene_duration)
        
        # Step 3: Validate the result
        validation = self.validate_scene_continuity(fixed_scenes)
        
        if not validation['is_valid']:
            # If still issues, try alternative approach
            fixed_scenes = self.fix_gaps_shift_following(scenes)
            fixed_scenes = self.fix_overlaps_trim_previous(fixed_scenes)
        
        return fixed_scenes

    def enforce_total_duration(
        self, 
        scenes: List[Dict[str, float]], 
        target_duration: float
    ) -> List[Dict[str, float]]:
        """
        Adjust scenes to match target total duration (usually audio duration).
        
        Args:
            scenes: List of scene dictionaries
            target_duration: Target total duration in seconds
            
        Returns:
            List of adjusted scene dictionaries
        """
        if not scenes:
            return scenes
        
        fixed_scenes = copy.deepcopy(scenes)
        current_total = sum(scene['duration'] for scene in fixed_scenes)
        
        if abs(current_total - target_duration) < self.default_tolerance:
            return fixed_scenes  # Already matches
        
        # Calculate adjustment factor
        adjustment_factor = target_duration / current_total
        
        # Proportionally adjust each scene duration
        cumulative_time = 0.0
        for scene in fixed_scenes:
            scene['start_time'] = cumulative_time
            scene['duration'] *= adjustment_factor
            scene['end_time'] = scene['start_time'] + scene['duration']
            cumulative_time = scene['end_time']
        
        # Final adjustment to ensure exact match
        actual_total = cumulative_time
        if abs(actual_total - target_duration) > self.default_tolerance:
            # Adjust last scene to match exactly
            last_scene = fixed_scenes[-1]
            adjustment = target_duration - actual_total
            last_scene['duration'] += adjustment
            last_scene['end_time'] += adjustment
        
        return fixed_scenes

    def _validate_scene_data(self, scenes: List[Dict[str, float]]) -> None:
        """
        Validate scene data integrity.
        
        Args:
            scenes: List of scene dictionaries to validate
            
        Raises:
            ValueError: If scene data is invalid
        """
        for i, scene in enumerate(scenes):
            # Check required fields
            required_fields = ['start_time', 'end_time', 'duration']
            for field in required_fields:
                if field not in scene:
                    raise ValueError(f"Scene {i} missing required field: {field}")
            
            # Check logical consistency
            if scene['end_time'] <= scene['start_time']:
                raise ValueError(f"Scene {i}: end_time ({scene['end_time']}) must be greater than start_time ({scene['start_time']})")
            
            # Check duration consistency
            calculated_duration = scene['end_time'] - scene['start_time']
            if abs(calculated_duration - scene['duration']) > self.default_tolerance:
                raise ValueError(f"Scene {i}: duration mismatch - calculated: {calculated_duration}, specified: {scene['duration']}")
            
            # Check for negative values
            if scene['start_time'] < 0 or scene['duration'] <= 0:
                raise ValueError(f"Scene {i}: negative start_time or non-positive duration")

    def get_continuity_summary(self, scenes: List[Dict[str, float]]) -> Dict[str, Any]:
        """
        Get comprehensive summary of scene continuity.
        
        Args:
            scenes: List of scene dictionaries
            
        Returns:
            Dictionary with continuity summary
        """
        validation = self.validate_scene_continuity(scenes)
        
        summary = {
            'scene_count': len(scenes),
            'total_duration': validation['total_duration'],
            'is_continuous': validation['is_valid'],
            'gap_count': len(validation['gaps']),
            'overlap_count': len(validation['overlaps']),
            'total_gap_duration': sum(gap['gap_duration'] for gap in validation['gaps']),
            'total_overlap_duration': sum(overlap['overlap_duration'] for overlap in validation['overlaps']),
            'issues': validation['gaps'] + validation['overlaps']
        }
        
        return summary