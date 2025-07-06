"""
Test cases for AudioDurationExtractor

Following TDD approach - these tests will fail initially and drive the implementation.
Based on wanx patterns for precise audio duration extraction.
"""

import pytest
import tempfile
import io
from unittest.mock import Mock, patch
from aidobe_video_processor.audio_duration import AudioDurationExtractor


class TestAudioDurationExtractor:
    """Test AudioDurationExtractor for precise audio duration extraction."""

    def setup_method(self):
        """Setup test fixtures."""
        self.extractor = AudioDurationExtractor()

    def test_extract_duration_from_mp3_file(self):
        """Test extracting duration from MP3 file."""
        # This test will fail initially - driving implementation
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
            # Mock audio file with known duration
            temp_file.write(b"mock_mp3_data")
            temp_file.flush()
            
            # Mock librosa module at import time
            with patch.dict('sys.modules', {'librosa': Mock()}):
                import sys
                mock_librosa = sys.modules['librosa']
                mock_librosa.get_duration.return_value = 45.678
                
                duration = self.extractor.extract_duration(temp_file.name)
                
                assert duration == 45.678
                mock_librosa.get_duration.assert_called_once_with(path=temp_file.name)

    def test_extract_duration_from_wav_file(self):
        """Test extracting duration from WAV file."""
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_file:
            temp_file.write(b"mock_wav_data")
            temp_file.flush()
            
            with patch('aidobe_video_processor.audio_duration.librosa.get_duration') as mock_duration:
                mock_duration.return_value = 123.456
                
                duration = self.extractor.extract_duration(temp_file.name)
                
                assert duration == 123.456

    def test_extract_duration_from_url(self):
        """Test extracting duration from audio URL."""
        audio_url = "https://example.com/audio.mp3"
        
        with patch('requests.get') as mock_get, \
             patch('librosa.get_duration') as mock_duration:
            
            # Mock HTTP response
            mock_response = Mock()
            mock_response.content = b"mock_audio_data"
            mock_response.raise_for_status = Mock()
            mock_get.return_value = mock_response
            
            mock_duration.return_value = 67.89
            
            duration = self.extractor.extract_duration_from_url(audio_url)
            
            assert duration == 67.89
            mock_get.assert_called_once_with(audio_url)

    def test_extract_duration_precision(self):
        """Test that duration extraction maintains high precision."""
        with tempfile.NamedTemporaryFile(suffix=".mp3") as temp_file:
            with patch('aidobe_video_processor.audio_duration.librosa.get_duration') as mock_duration:
                # Test with very precise duration (millisecond precision)
                mock_duration.return_value = 89.123456789
                
                duration = self.extractor.extract_duration(temp_file.name)
                
                # Should maintain precision to at least 3 decimal places
                assert round(duration, 3) == 89.123

    def test_extract_duration_invalid_file(self):
        """Test handling of invalid audio file."""
        with patch('aidobe_video_processor.audio_duration.librosa.get_duration') as mock_duration:
            mock_duration.side_effect = Exception("Invalid audio file")
            
            with pytest.raises(Exception) as excinfo:
                self.extractor.extract_duration("invalid_file.mp3")
            
            assert "Invalid audio file" in str(excinfo.value)

    def test_extract_duration_network_error(self):
        """Test handling of network errors when downloading from URL."""
        with patch('aidobe_video_processor.audio_duration.requests.get') as mock_get:
            mock_get.side_effect = Exception("Network error")
            
            with pytest.raises(Exception) as excinfo:
                self.extractor.extract_duration_from_url("http://invalid-url.com/audio.mp3")
            
            assert "Network error" in str(excinfo.value)

    def test_extract_duration_fallback_to_moviepy(self):
        """Test fallback to MoviePy when librosa fails."""
        with tempfile.NamedTemporaryFile(suffix=".mp3") as temp_file:
            with patch('librosa.get_duration') as mock_librosa, \
                 patch('aidobe_video_processor.audio_duration.AudioFileClip') as mock_moviepy:
                
                # librosa fails
                mock_librosa.side_effect = Exception("Librosa failed")
                
                # MoviePy succeeds
                mock_clip = Mock()
                mock_clip.duration = 98.765
                mock_clip.close = Mock()
                mock_moviepy.return_value = mock_clip
                
                duration = self.extractor.extract_duration(temp_file.name)
                
                assert duration == 98.765
                mock_clip.close.assert_called_once()

    def test_multiple_duration_extractions(self):
        """Test extracting durations from multiple audio files."""
        files_and_durations = [
            ("file1.mp3", 30.0),
            ("file2.wav", 45.5),
            ("file3.m4a", 120.25)
        ]
        
        with patch('aidobe_video_processor.audio_duration.librosa.get_duration') as mock_duration:
            # Mock different durations for different files
            mock_duration.side_effect = [30.0, 45.5, 120.25]
            
            durations = self.extractor.extract_multiple_durations([f[0] for f in files_and_durations])
            
            expected_durations = [30.0, 45.5, 120.25]
            assert durations == expected_durations
            assert mock_duration.call_count == 3

    def test_extract_duration_with_caching(self):
        """Test that duplicate file paths use cached results."""
        file_path = "test_audio.mp3"
        
        with patch('aidobe_video_processor.audio_duration.librosa.get_duration') as mock_duration:
            mock_duration.return_value = 75.5
            
            # First call
            duration1 = self.extractor.extract_duration(file_path, use_cache=True)
            # Second call with same file
            duration2 = self.extractor.extract_duration(file_path, use_cache=True)
            
            assert duration1 == 75.5
            assert duration2 == 75.5
            # Should only call librosa once due to caching
            mock_duration.assert_called_once()

    def test_extract_duration_from_bytes(self):
        """Test extracting duration from audio bytes data."""
        audio_bytes = b"mock_audio_file_content"
        
        with patch('aidobe_video_processor.audio_duration.librosa.get_duration') as mock_duration, \
             patch('aidobe_video_processor.audio_duration.tempfile.NamedTemporaryFile') as mock_temp:
            
            # Mock temporary file
            mock_temp_file = Mock()
            mock_temp_file.name = "/tmp/temp_audio.mp3"
            mock_temp_file.write = Mock()
            mock_temp_file.flush = Mock()
            mock_temp_file.__enter__ = Mock(return_value=mock_temp_file)
            mock_temp_file.__exit__ = Mock(return_value=None)
            mock_temp.return_value = mock_temp_file
            
            mock_duration.return_value = 55.125
            
            duration = self.extractor.extract_duration_from_bytes(audio_bytes)
            
            assert duration == 55.125
            mock_temp_file.write.assert_called_once_with(audio_bytes)
            mock_temp_file.flush.assert_called_once()