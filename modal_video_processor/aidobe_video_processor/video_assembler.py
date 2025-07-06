"""
VideoAssembler

Complete video assembly pipeline using MoviePy CompositeVideoClip.
Integrates AudioDurationExtractor, SceneTimingCalculator, SceneGapValidator, and AudioMasterSync.
Based on wanx patterns for professional video generation.
"""

from typing import List, Dict, Any, Optional, Callable, Tuple
import tempfile
import os
from .audio_duration import AudioDurationExtractor
from .scene_timing import SceneTimingCalculator
from .scene_gap_validator import SceneGapValidator
from .audio_master_sync import AudioMasterSync


class VideoAssembler:
    """Complete video assembly pipeline with integrated timing and validation."""

    def __init__(self):
        """Initialize the video assembler with component dependencies."""
        self.audio_extractor = AudioDurationExtractor()
        self.scene_timing = SceneTimingCalculator()
        self.gap_validator = SceneGapValidator()
        self.audio_sync = AudioMasterSync()

    def assemble_video(
        self, 
        video_clips: List[Any], 
        audio_clip: Any,
        output_config: Optional[Dict[str, Any]] = None
    ) -> Any:
        """
        Assemble basic video with synchronized audio.
        
        Args:
            video_clips: List of video clip objects (MoviePy VideoClips)
            audio_clip: Audio clip object (MoviePy AudioClip)
            output_config: Output configuration (resolution, fps, etc.)
            
        Returns:
            Assembled composite video clip
            
        Raises:
            ValueError: If inputs are invalid
            Exception: If assembly fails
        """
        self._validate_inputs(video_clips, audio_clip)
        
        try:
            # Import MoviePy components
            try:
                from moviepy.editor import CompositeVideoClip, concatenate_videoclips
            except ImportError:
                # For testing - use mocked functions if available
                concatenate_videoclips = globals().get('concatenate_videoclips')
                CompositeVideoClip = globals().get('CompositeVideoClip')
                if not concatenate_videoclips:
                    raise ImportError("MoviePy not available and no mock provided")
            
            # Concatenate video clips into single timeline
            if len(video_clips) == 1:
                final_video = video_clips[0]
            else:
                final_video = concatenate_videoclips(video_clips)
            
            # Set audio track
            final_video = final_video.set_audio(audio_clip)
            
            # Apply output configuration if provided
            if output_config:
                final_video = self._apply_output_config(final_video, output_config)
            
            return final_video
            
        except Exception as e:
            raise Exception(f"Video assembly failed: {e}")

    def assemble_video_with_timing(
        self, 
        video_clips: List[Any], 
        audio_clip: Any,
        use_scene_timing: bool = True
    ) -> Any:
        """
        Assemble video with SceneTimingCalculator integration.
        
        Args:
            video_clips: List of video clip objects
            audio_clip: Audio clip object
            use_scene_timing: Whether to use scene timing calculator
            
        Returns:
            Assembled video with proper timing
        """
        if use_scene_timing:
            # Calculate optimal scene durations based on audio
            audio_duration = audio_clip.duration
            scene_durations = self.scene_timing.distribute_scene_durations(
                audio_duration, 
                len(video_clips)
            )
            
            # Sync each video clip to its calculated duration
            synced_clips = []
            for clip, duration in zip(video_clips, scene_durations):
                synced_clip = self.audio_sync.sync_video_to_audio_duration(clip, duration)
                synced_clips.append(synced_clip)
            
            video_clips = synced_clips
        
        return self.assemble_video(video_clips, audio_clip)

    def assemble_video_with_validation(
        self, 
        video_clips: List[Any], 
        audio_clip: Any,
        fix_gaps: bool = True
    ) -> Any:
        """
        Assemble video with SceneGapValidator integration.
        
        Args:
            video_clips: List of video clip objects
            audio_clip: Audio clip object
            fix_gaps: Whether to fix timing gaps automatically
            
        Returns:
            Assembled video with validated timing
        """
        if fix_gaps:
            # Create scene timing data for validation
            scenes = []
            current_time = 0.0
            for clip in video_clips:
                duration = clip.duration
                scenes.append({
                    'start_time': current_time,
                    'end_time': current_time + duration,
                    'duration': duration
                })
                current_time += duration
            
            # Validate and fix timing issues
            validation = self.gap_validator.validate_scene_continuity(scenes)
            if not validation['is_valid']:
                fixed_scenes = self.gap_validator.fix_all_timing_issues(scenes)
                
                # Apply fixed timing to video clips
                for i, (clip, fixed_scene) in enumerate(zip(video_clips, fixed_scenes)):
                    video_clips[i] = clip.set_duration(fixed_scene['duration'])
        
        return self.assemble_video(video_clips, audio_clip)

    def assemble_video_with_audio_sync(
        self, 
        video_clips: List[Any], 
        audio_clip: Any,
        enforce_audio_priority: bool = True
    ) -> Any:
        """
        Assemble video with AudioMasterSync integration.
        
        Args:
            video_clips: List of video clip objects
            audio_clip: Audio clip object
            enforce_audio_priority: Whether audio timing takes priority
            
        Returns:
            Assembled video with audio-synchronized timing
        """
        if enforce_audio_priority:
            # Force video duration to match audio duration exactly
            audio_duration = audio_clip.duration
            synced_clips = self.audio_sync.sync_complete_video_to_master_audio(
                video_clips, 
                audio_duration
            )
            video_clips = synced_clips
        
        return self.assemble_video(video_clips, audio_clip)

    def assemble_video_with_effects(
        self, 
        video_clips: List[Any], 
        audio_clip: Any,
        effects_config: Dict[str, Any]
    ) -> Any:
        """
        Assemble video with effects and transitions.
        
        Args:
            video_clips: List of video clip objects
            audio_clip: Audio clip object
            effects_config: Effects configuration
            
        Returns:
            Assembled video with effects applied
        """
        # Apply effects to individual clips if specified
        if 'effects' in effects_config:
            for i, clip in enumerate(video_clips):
                video_clips[i] = self._apply_clip_effects(clip, effects_config['effects'])
        
        # Assemble base video
        assembled_video = self.assemble_video(video_clips, audio_clip)
        
        # Apply global effects if specified
        if 'global_effects' in effects_config:
            assembled_video = self._apply_global_effects(assembled_video, effects_config['global_effects'])
        
        return assembled_video

    def assemble_video_with_captions(
        self, 
        video_clips: List[Any], 
        audio_clip: Any,
        captions_data: List[Dict[str, Any]],
        caption_style: Optional[Dict[str, Any]] = None
    ) -> Any:
        """
        Assemble video with caption overlays.
        
        Args:
            video_clips: List of video clip objects
            audio_clip: Audio clip object
            captions_data: Caption timing and text data
            caption_style: Caption styling configuration
            
        Returns:
            Assembled video with captions
        """
        # Assemble base video
        base_video = self.assemble_video(video_clips, audio_clip)
        
        if not captions_data:
            return base_video
        
        # Create caption clips
        caption_clips = self._create_caption_clips(captions_data, caption_style)
        
        # Composite video with captions
        from moviepy.editor import CompositeVideoClip
        final_video = CompositeVideoClip([base_video] + caption_clips)
        
        return final_video

    def assemble_complete_video(
        self, 
        video_clips: List[Any], 
        audio_clip: Any,
        captions_data: Optional[List[Dict[str, Any]]] = None,
        effects_config: Optional[Dict[str, Any]] = None,
        output_config: Optional[Dict[str, Any]] = None
    ) -> Any:
        """
        Complete video assembly pipeline with all components integrated.
        
        Args:
            video_clips: List of video clip objects
            audio_clip: Audio clip object
            captions_data: Optional caption data
            effects_config: Optional effects configuration
            output_config: Optional output configuration
            
        Returns:
            Fully assembled and processed video
        """
        # Step 1: Scene timing calculation
        audio_duration = audio_clip.duration
        scene_durations = self.scene_timing.distribute_scene_durations(
            audio_duration, 
            len(video_clips)
        )
        
        # Step 2: Audio-master synchronization
        synced_clips = self.audio_sync.sync_complete_video_to_master_audio(
            video_clips, 
            audio_duration,
            scene_durations=scene_durations
        )
        
        # Step 3: Gap validation and fixing
        scenes = []
        current_time = 0.0
        for clip, duration in zip(synced_clips, scene_durations):
            scenes.append({
                'start_time': current_time,
                'end_time': current_time + duration,
                'duration': duration
            })
            current_time += duration
        
        validation = self.gap_validator.validate_scene_continuity(scenes)
        if not validation['is_valid']:
            fixed_scenes = self.gap_validator.fix_all_timing_issues(scenes)
            # Apply fixes to clips
            for i, fixed_scene in enumerate(fixed_scenes):
                synced_clips[i] = synced_clips[i].set_duration(fixed_scene['duration'])
        
        # Step 4: Effects application
        if effects_config:
            for i, clip in enumerate(synced_clips):
                synced_clips[i] = self._apply_clip_effects(clip, effects_config.get('effects', []))
        
        # Step 5: Video assembly
        assembled_video = self.assemble_video(synced_clips, audio_clip, output_config)
        
        # Step 6: Caption overlay
        if captions_data:
            caption_clips = self._create_caption_clips(captions_data, effects_config.get('caption_style'))
            from moviepy.editor import CompositeVideoClip
            assembled_video = CompositeVideoClip([assembled_video] + caption_clips)
        
        return assembled_video

    def assemble_video_with_background_music(
        self, 
        video_clips: List[Any], 
        main_audio: Any,
        background_music: Any,
        music_volume: float = 0.08,
        fade_duration: float = 2.0
    ) -> Any:
        """
        Assemble video with background music mixing.
        
        Args:
            video_clips: List of video clip objects
            main_audio: Main audio track
            background_music: Background music track
            music_volume: Volume level for background music
            fade_duration: Fade in/out duration for music
            
        Returns:
            Assembled video with mixed audio
        """
        # Prepare background music
        music_duration = main_audio.duration
        background_music = background_music.subclip(0, music_duration)
        background_music = background_music.volumex(music_volume)
        
        # Add fade in/out to background music
        if fade_duration > 0:
            background_music = background_music.audio_fadein(fade_duration)
            background_music = background_music.audio_fadeout(fade_duration)
        
        # Composite audio tracks
        from moviepy.editor import CompositeAudioClip
        mixed_audio = CompositeAudioClip([main_audio, background_music])
        
        # Assemble video with mixed audio
        return self.assemble_video(video_clips, mixed_audio)

    def assemble_video_with_speed_adjustment(
        self, 
        video_clips: List[Any], 
        audio_clip: Any,
        target_duration: float,
        preserve_pitch: bool = True
    ) -> Any:
        """
        Assemble video with speed adjustment for timing.
        
        Args:
            video_clips: List of video clip objects
            audio_clip: Audio clip object
            target_duration: Target video duration
            preserve_pitch: Whether to preserve audio pitch
            
        Returns:
            Assembled video with speed adjustment
        """
        # Calculate total video duration
        total_video_duration = sum(clip.duration for clip in video_clips)
        
        if abs(total_video_duration - target_duration) > 0.1:
            # Calculate speed factor
            speed_factor = total_video_duration / target_duration
            
            # Apply speed adjustment to video clips
            adjusted_clips = []
            for clip in video_clips:
                if speed_factor != 1.0:
                    adjusted_clip = clip.fx(lambda c: c.speedx(speed_factor))
                    adjusted_clips.append(adjusted_clip)
                else:
                    adjusted_clips.append(clip)
            
            video_clips = adjusted_clips
        
        return self.assemble_video(video_clips, audio_clip)

    def assemble_video_optimized(
        self, 
        video_clips: List[Any], 
        audio_clip: Any,
        chunk_size: int = 5,
        cleanup_intermediate: bool = True
    ) -> Any:
        """
        Assemble video with memory optimization for large projects.
        
        Args:
            video_clips: List of video clip objects
            audio_clip: Audio clip object
            chunk_size: Number of clips to process in each chunk
            cleanup_intermediate: Whether to cleanup intermediate files
            
        Returns:
            Memory-optimized assembled video
        """
        if len(video_clips) <= chunk_size:
            return self.assemble_video(video_clips, audio_clip)
        
        # Process clips in chunks to manage memory
        from moviepy.editor import concatenate_videoclips
        
        chunk_clips = []
        for i in range(0, len(video_clips), chunk_size):
            chunk = video_clips[i:i + chunk_size]
            chunk_video = concatenate_videoclips(chunk)
            chunk_clips.append(chunk_video)
        
        # Concatenate chunks
        final_video = concatenate_videoclips(chunk_clips)
        final_video = final_video.set_audio(audio_clip)
        
        return final_video

    def assemble_video_with_progress(
        self, 
        video_clips: List[Any], 
        audio_clip: Any,
        progress_callback: Callable[[float], None]
    ) -> Any:
        """
        Assemble video with progress reporting.
        
        Args:
            video_clips: List of video clip objects
            audio_clip: Audio clip object
            progress_callback: Function to call with progress updates (0.0 to 1.0)
            
        Returns:
            Assembled video with progress reporting
        """
        total_steps = 4  # Timing, sync, validation, assembly
        current_step = 0
        
        # Step 1: Scene timing
        progress_callback(current_step / total_steps)
        audio_duration = audio_clip.duration
        scene_durations = self.scene_timing.distribute_scene_durations(audio_duration, len(video_clips))
        current_step += 1
        
        # Step 2: Audio sync
        progress_callback(current_step / total_steps)
        synced_clips = self.audio_sync.sync_complete_video_to_master_audio(video_clips, audio_duration, scene_durations)
        current_step += 1
        
        # Step 3: Validation
        progress_callback(current_step / total_steps)
        # (validation logic here)
        current_step += 1
        
        # Step 4: Assembly
        progress_callback(current_step / total_steps)
        assembled_video = self.assemble_video(synced_clips, audio_clip)
        
        progress_callback(1.0)  # Complete
        return assembled_video

    def export_video(
        self, 
        composite_video: Any, 
        output_path: str,
        export_config: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Export assembled video with quality settings.
        
        Args:
            composite_video: Assembled composite video
            output_path: Output file path
            export_config: Export configuration
            
        Returns:
            Path to exported video file
        """
        export_kwargs = {
            'filename': output_path,
            'fps': 30,
            'codec': 'libx264',
            'audio_codec': 'aac'
        }
        
        if export_config:
            export_kwargs.update(export_config)
        
        composite_video.write_videofile(**export_kwargs)
        return output_path

    def get_assembly_metadata(
        self, 
        video_clips: List[Any], 
        audio_clip: Any
    ) -> Dict[str, Any]:
        """
        Get comprehensive metadata about the assembly.
        
        Args:
            video_clips: List of video clip objects
            audio_clip: Audio clip object
            
        Returns:
            Dictionary with assembly metadata
        """
        total_video_duration = sum(clip.duration for clip in video_clips)
        
        # Get representative clip properties
        first_clip = video_clips[0] if video_clips else None
        
        metadata = {
            'clip_count': len(video_clips),
            'total_video_duration': total_video_duration,
            'audio_duration': audio_clip.duration,
            'duration_match': abs(total_video_duration - audio_clip.duration) < 0.1,
            'resolution': getattr(first_clip, 'size', None),
            'fps': getattr(first_clip, 'fps', None)
        }
        
        return metadata

    def create_preview(
        self, 
        video_clips: List[Any], 
        audio_clip: Any,
        preview_duration: float = 10.0,
        preview_quality: str = 'low'
    ) -> Any:
        """
        Create preview of assembly without full export.
        
        Args:
            video_clips: List of video clip objects
            audio_clip: Audio clip object
            preview_duration: Duration of preview in seconds
            preview_quality: Quality level ('low', 'medium', 'high')
            
        Returns:
            Preview video clip
        """
        # Create short preview
        preview_audio = audio_clip.subclip(0, min(preview_duration, audio_clip.duration))
        
        # Proportionally trim video clips
        total_video_duration = sum(clip.duration for clip in video_clips)
        scale_factor = preview_duration / total_video_duration
        
        preview_clips = []
        for clip in video_clips:
            preview_clip_duration = clip.duration * scale_factor
            preview_clip = clip.subclip(0, min(preview_clip_duration, clip.duration))
            preview_clips.append(preview_clip)
        
        # Assemble preview
        preview_video = self.assemble_video(preview_clips, preview_audio)
        
        # Apply quality settings
        if preview_quality == 'low':
            preview_video = preview_video.resize(0.5)  # Half resolution
        
        return preview_video

    def _validate_inputs(self, video_clips: List[Any], audio_clip: Any) -> None:
        """Validate assembly inputs."""
        if not video_clips:
            raise ValueError("Video clips cannot be empty")
        
        if audio_clip is None:
            raise ValueError("Audio clip is required")
        
        # Validate clip properties
        for i, clip in enumerate(video_clips):
            if not hasattr(clip, 'duration') or clip.duration is None:
                raise ValueError(f"Video clip {i} missing duration property")

    def _apply_output_config(self, video: Any, config: Dict[str, Any]) -> Any:
        """Apply output configuration to video."""
        if 'resolution' in config:
            resolution = config['resolution']
            if resolution == '1080p':
                video = video.resize((1920, 1080))
            elif resolution == '720p':
                video = video.resize((1280, 720))
            elif resolution == '480p':
                video = video.resize((854, 480))
        
        if 'fps' in config:
            video = video.set_fps(config['fps'])
        
        return video

    def _apply_clip_effects(self, clip: Any, effects: List[Dict[str, Any]]) -> Any:
        """Apply effects to individual clip."""
        for effect in effects:
            if effect.get('type') == 'ken_burns' and effect.get('enabled'):
                # Apply Ken Burns effect (zoom/pan)
                # This would integrate with KenBurnsFFmpeg when implemented
                pass
        return clip

    def _apply_global_effects(self, video: Any, effects: List[Dict[str, Any]]) -> Any:
        """Apply global effects to assembled video."""
        for effect in effects:
            effect_type = effect.get('type')
            if effect_type == 'fade_in':
                duration = effect.get('duration', 1.0)
                video = video.fadein(duration)
            elif effect_type == 'fade_out':
                duration = effect.get('duration', 1.0)
                video = video.fadeout(duration)
        return video

    def _create_caption_clips(
        self, 
        captions_data: List[Dict[str, Any]], 
        style: Optional[Dict[str, Any]]
    ) -> List[Any]:
        """Create caption clips for overlay."""
        from moviepy.editor import TextClip
        
        caption_clips = []
        default_style = {
            'fontsize': 24,
            'color': 'white',
            'font': 'Arial-Bold'
        }
        
        if style:
            default_style.update(style)
        
        for caption in captions_data:
            text_clip = TextClip(
                caption['text'],
                **default_style
            ).set_start(caption['start_time']).set_end(caption['end_time'])
            
            # Position caption at bottom center
            text_clip = text_clip.set_position(('center', 'bottom'))
            caption_clips.append(text_clip)
        
        return caption_clips