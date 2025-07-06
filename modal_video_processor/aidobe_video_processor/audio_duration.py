"""
AudioDurationExtractor

Extracts precise audio duration using librosa with MoviePy fallback.
Based on wanx patterns for handling audio timing in video processing.
"""

import tempfile
import os
from typing import List, Optional
import requests


class AudioDurationExtractor:
    """Extract precise audio duration from various audio sources."""
    
    def __init__(self):
        """Initialize the audio duration extractor."""
        self._duration_cache = {}
    
    def extract_duration(self, file_path: str, use_cache: bool = False) -> float:
        """
        Extract duration from audio file path.
        
        Args:
            file_path: Path to audio file
            use_cache: Whether to use cached results for duplicate paths
            
        Returns:
            Duration in seconds (float)
            
        Raises:
            Exception: If audio file cannot be processed
        """
        if use_cache and file_path in self._duration_cache:
            return self._duration_cache[file_path]
        
        try:
            # Primary: Use librosa for precise duration
            import librosa
            duration = librosa.get_duration(path=file_path)
            
        except Exception as e:
            # Fallback: Use MoviePy if librosa fails
            try:
                from moviepy.editor import AudioFileClip
                clip = AudioFileClip(file_path)
                duration = clip.duration
                clip.close()
                
            except Exception as fallback_error:
                raise Exception(f"Both librosa and MoviePy failed: {e}, {fallback_error}")
        
        if use_cache:
            self._duration_cache[file_path] = duration
            
        return duration
    
    def extract_duration_from_url(self, audio_url: str) -> float:
        """
        Extract duration from audio URL by downloading and processing.
        
        Args:
            audio_url: URL to audio file
            
        Returns:
            Duration in seconds (float)
            
        Raises:
            Exception: If download or processing fails
        """
        # Download audio file
        response = requests.get(audio_url)
        response.raise_for_status()
        
        # Extract duration from downloaded bytes
        return self.extract_duration_from_bytes(response.content)
    
    def extract_duration_from_bytes(self, audio_bytes: bytes) -> float:
        """
        Extract duration from audio bytes data.
        
        Args:
            audio_bytes: Audio file content as bytes
            
        Returns:
            Duration in seconds (float)
        """
        # Write bytes to temporary file and extract duration
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_file.flush()
            
            try:
                duration = self.extract_duration(temp_file.name)
            finally:
                # Clean up temporary file
                os.unlink(temp_file.name)
                
        return duration
    
    def extract_multiple_durations(self, file_paths: List[str]) -> List[float]:
        """
        Extract durations from multiple audio files.
        
        Args:
            file_paths: List of audio file paths
            
        Returns:
            List of durations in seconds
        """
        durations = []
        for file_path in file_paths:
            duration = self.extract_duration(file_path)
            durations.append(duration)
        return durations
    
    def clear_cache(self):
        """Clear the duration cache."""
        self._duration_cache.clear()