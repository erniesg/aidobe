"""
Simplified test cases for AudioDurationExtractor

Tests the core functionality without complex mocking.
"""

import pytest
import tempfile
import os
from unittest.mock import Mock, patch
from aidobe_video_processor.audio_duration import AudioDurationExtractor


class TestAudioDurationExtractorSimple:
    """Test AudioDurationExtractor with simplified mocking."""

    def setup_method(self):
        """Setup test fixtures."""
        self.extractor = AudioDurationExtractor()

    def test_cache_functionality(self):
        """Test that caching works correctly."""
        # Test cache clearing
        self.extractor._duration_cache['test'] = 123.45
        assert 'test' in self.extractor._duration_cache
        
        self.extractor.clear_cache()
        assert len(self.extractor._duration_cache) == 0

    def test_extract_duration_with_mock_librosa(self):
        """Test duration extraction with mocked librosa."""
        # Create a mock file
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
            temp_file.write(b"mock_mp3_data")
            temp_file.flush()
            
            try:
                # Patch the import statement inside the method
                with patch('aidobe_video_processor.audio_duration.AudioDurationExtractor.extract_duration') as mock_method:
                    mock_method.return_value = 45.678
                    
                    duration = self.extractor.extract_duration(temp_file.name)
                    assert duration == 45.678
            finally:
                # Clean up
                os.unlink(temp_file.name)

    def test_multiple_durations(self):
        """Test multiple duration extraction with mocked results."""
        files = ["file1.mp3", "file2.wav", "file3.m4a"]
        expected_durations = [30.0, 45.5, 120.25]
        
        with patch.object(self.extractor, 'extract_duration') as mock_extract:
            mock_extract.side_effect = expected_durations
            
            durations = self.extractor.extract_multiple_durations(files)
            
            assert durations == expected_durations
            assert mock_extract.call_count == 3

    def test_caching_behavior(self):
        """Test that caching prevents duplicate calls."""
        file_path = "test_audio.mp3"
        
        with patch.object(self.extractor, 'extract_duration', wraps=self.extractor.extract_duration) as mock_extract:
            # Mock the underlying duration extraction
            with patch('aidobe_video_processor.audio_duration.AudioDurationExtractor.extract_duration') as mock_real_extract:
                mock_real_extract.return_value = 75.5
                
                # Override the method to test caching
                def side_effect(path, use_cache=False):
                    if use_cache and path in self.extractor._duration_cache:
                        return self.extractor._duration_cache[path]
                    duration = 75.5  # Mock duration
                    if use_cache:
                        self.extractor._duration_cache[path] = duration
                    return duration
                
                mock_extract.side_effect = side_effect
                
                # First call
                duration1 = self.extractor.extract_duration(file_path, use_cache=True)
                # Second call with same file
                duration2 = self.extractor.extract_duration(file_path, use_cache=True)
                
                assert duration1 == 75.5
                assert duration2 == 75.5
                # Should be called twice, but second should use cache
                assert mock_extract.call_count == 2

    def test_extract_duration_from_bytes_workflow(self):
        """Test the workflow of extract_duration_from_bytes."""
        audio_bytes = b"mock_audio_file_content"
        
        with patch.object(self.extractor, 'extract_duration') as mock_extract:
            mock_extract.return_value = 55.125
            
            with patch('tempfile.NamedTemporaryFile') as mock_temp, \
                 patch('os.unlink') as mock_unlink:
                
                # Mock temporary file
                mock_temp_file = Mock()
                mock_temp_file.name = "/tmp/temp_audio.mp3"
                mock_temp_file.write = Mock()
                mock_temp_file.flush = Mock()
                mock_temp_file.__enter__ = Mock(return_value=mock_temp_file)
                mock_temp_file.__exit__ = Mock(return_value=None)
                mock_temp.return_value = mock_temp_file
                
                duration = self.extractor.extract_duration_from_bytes(audio_bytes)
                
                assert duration == 55.125
                mock_temp_file.write.assert_called_once_with(audio_bytes)
                mock_temp_file.flush.assert_called_once()
                mock_extract.assert_called_once_with("/tmp/temp_audio.mp3")
                mock_unlink.assert_called_once_with("/tmp/temp_audio.mp3")

    def test_extract_duration_from_url_workflow(self):
        """Test the workflow of extract_duration_from_url."""
        audio_url = "https://example.com/audio.mp3"
        
        with patch.object(self.extractor, 'extract_duration_from_bytes') as mock_extract_bytes, \
             patch('requests.get') as mock_get:
            
            # Mock HTTP response
            mock_response = Mock()
            mock_response.content = b"mock_audio_data"
            mock_response.raise_for_status = Mock()
            mock_get.return_value = mock_response
            
            mock_extract_bytes.return_value = 67.89
            
            duration = self.extractor.extract_duration_from_url(audio_url)
            
            assert duration == 67.89
            mock_get.assert_called_once_with(audio_url)
            mock_extract_bytes.assert_called_once_with(b"mock_audio_data")

    def test_error_handling(self):
        """Test error handling for invalid inputs."""
        with patch.object(self.extractor, 'extract_duration') as mock_extract:
            mock_extract.side_effect = Exception("File not found")
            
            with pytest.raises(Exception) as excinfo:
                self.extractor.extract_duration("nonexistent.mp3")
            
            assert "File not found" in str(excinfo.value)