import { describe, it, expect, beforeEach } from 'vitest'
import { TranscriptSplitter } from '../../../src/utils/transcript-splitter'
import type { WordTiming } from '../../../src/schemas/audio'

describe('TranscriptSplitter', () => {
  let splitter: TranscriptSplitter

  beforeEach(() => {
    splitter = new TranscriptSplitter()
  })

  describe('splitByCharacterLimit', () => {
    it('should split transcript into chunks under character limit', () => {
      const transcript = 'Hello world. This is a test sentence. Another sentence here.'
      const wordTimings: WordTiming[] = [
        { word: 'Hello', startTime: 0, endTime: 0.5 },
        { word: 'world', startTime: 0.5, endTime: 1.0 },
        { word: 'This', startTime: 1.5, endTime: 1.8 },
        { word: 'is', startTime: 1.8, endTime: 2.0 },
        { word: 'a', startTime: 2.0, endTime: 2.1 },
        { word: 'test', startTime: 2.1, endTime: 2.5 },
        { word: 'sentence', startTime: 2.5, endTime: 3.2 },
        { word: 'Another', startTime: 3.5, endTime: 4.0 },
        { word: 'sentence', startTime: 4.0, endTime: 4.5 },
        { word: 'here', startTime: 4.5, endTime: 4.8 },
      ]

      const result = splitter.splitByCharacterLimit(transcript, wordTimings, 25)

      expect(result.chunks).toHaveLength(3)
      expect(result.chunks[0].text.length).toBeLessThanOrEqual(25)
      expect(result.chunks[1].text.length).toBeLessThanOrEqual(25)
      expect(result.chunks[2].text.length).toBeLessThanOrEqual(25)

      // Check that all text is preserved
      const combinedText = result.chunks.map((c) => c.text).join(' ')
      expect(combinedText.replace(/\s+/g, ' ')).toEqual(transcript.replace(/\s+/g, ' '))
    })

    it('should respect sentence boundaries when possible', () => {
      const transcript = 'Short. This is a longer sentence.'
      const wordTimings: WordTiming[] = [
        { word: 'Short', startTime: 0, endTime: 0.5 },
        { word: 'This', startTime: 1.0, endTime: 1.3 },
        { word: 'is', startTime: 1.3, endTime: 1.5 },
        { word: 'a', startTime: 1.5, endTime: 1.6 },
        { word: 'longer', startTime: 1.6, endTime: 2.0 },
        { word: 'sentence', startTime: 2.0, endTime: 2.5 },
      ]

      const result = splitter.splitByCharacterLimit(transcript, wordTimings, 8)

      expect(result.chunks[0].text).toBe('Short.')
      expect(result.chunks[0].startTime).toBe(0)
      expect(result.chunks[0].endTime).toBe(0.5)
    })

    it('should handle single words longer than limit by force splitting', () => {
      const transcript = 'Supercalifragilisticexpialidocious word.'
      const wordTimings: WordTiming[] = [
        { word: 'Supercalifragilisticexpialidocious', startTime: 0, endTime: 2.0 },
        { word: 'word', startTime: 2.5, endTime: 3.0 },
      ]

      const result = splitter.splitByCharacterLimit(transcript, wordTimings, 10)

      expect(result.chunks.length).toBeGreaterThan(1)
      expect(result.chunks[0].text.length).toBeLessThanOrEqual(10)
    })

    it('should preserve word timing information in chunks', () => {
      const transcript = 'Hello world. Another sentence.'
      const wordTimings: WordTiming[] = [
        { word: 'Hello', startTime: 0, endTime: 0.5 },
        { word: 'world', startTime: 0.5, endTime: 1.0 },
        { word: 'Another', startTime: 1.5, endTime: 2.0 },
        { word: 'sentence', startTime: 2.0, endTime: 2.8 },
      ]

      const result = splitter.splitByCharacterLimit(transcript, wordTimings, 15)

      expect(result.chunks[0].wordTimings).toHaveLength(2)
      expect(result.chunks[0].wordTimings[0].word).toBe('Hello')
      expect(result.chunks[0].wordTimings[1].word).toBe('world')
      expect(result.chunks[0].startTime).toBe(0)
      expect(result.chunks[0].endTime).toBe(1.0)
    })

    it('should be idempotent for same input', () => {
      const transcript = 'Same input test.'
      const wordTimings: WordTiming[] = [
        { word: 'Same', startTime: 0, endTime: 0.5 },
        { word: 'input', startTime: 0.5, endTime: 1.0 },
        { word: 'test', startTime: 1.0, endTime: 1.5 },
      ]

      const result1 = splitter.splitByCharacterLimit(transcript, wordTimings, 250)
      const result2 = splitter.splitByCharacterLimit(transcript, wordTimings, 250)

      expect(result1).toEqual(result2)
    })
  })

  describe('splitForArgil', () => {
    it('should split transcript for Argil 250-character limit', () => {
      const longTranscript =
        'This is a very long transcript that definitely exceeds the 250 character limit for Argil avatar generation. It should be split into multiple chunks that respect sentence boundaries where possible while staying under the character limit.'
      const wordTimings: WordTiming[] = Array.from({ length: 30 }, (_, i) => ({
        word: `word${i}`,
        startTime: i * 0.5,
        endTime: (i + 1) * 0.5,
      }))

      const result = splitter.splitForArgil(longTranscript, wordTimings)

      result.chunks.forEach((chunk) => {
        expect(chunk.text.length).toBeLessThanOrEqual(250)
      })
      expect(result.totalChunks).toBeGreaterThan(1)
    })

    it('should include metadata about splitting strategy', () => {
      const transcript = 'Short transcript.'
      const wordTimings: WordTiming[] = [
        { word: 'Short', startTime: 0, endTime: 0.5 },
        { word: 'transcript', startTime: 0.5, endTime: 1.5 },
      ]

      const result = splitter.splitForArgil(transcript, wordTimings)

      expect(result.metadata).toHaveProperty('splitStrategy')
      expect(result.metadata).toHaveProperty('averageChunkSize')
      expect(result.metadata).toHaveProperty('totalChunks')
    })
  })

  describe('splitBySentences', () => {
    it('should split transcript by sentence boundaries', () => {
      const transcript = 'First sentence. Second sentence! Third sentence?'
      const wordTimings: WordTiming[] = [
        { word: 'First', startTime: 0, endTime: 0.5 },
        { word: 'sentence', startTime: 0.5, endTime: 1.0 },
        { word: 'Second', startTime: 1.5, endTime: 2.0 },
        { word: 'sentence', startTime: 2.0, endTime: 2.5 },
        { word: 'Third', startTime: 3.0, endTime: 3.5 },
        { word: 'sentence', startTime: 3.5, endTime: 4.0 },
      ]

      const result = splitter.splitBySentences(transcript, wordTimings)

      expect(result.chunks).toHaveLength(3)
      expect(result.chunks[0].text).toBe('First sentence.')
      expect(result.chunks[1].text).toBe('Second sentence!')
      expect(result.chunks[2].text).toBe('Third sentence?')
    })
  })

  describe('splitByTimeSegments', () => {
    it('should split transcript by time duration', () => {
      const transcript = 'This is a long transcript with many words.'
      const wordTimings: WordTiming[] = Array.from({ length: 8 }, (_, i) => ({
        word: `word${i}`,
        startTime: i * 1.0,
        endTime: (i + 1) * 1.0,
      }))

      const result = splitter.splitByTimeSegments(transcript, wordTimings, 3.0)

      result.chunks.forEach((chunk) => {
        const duration = chunk.endTime - chunk.startTime
        expect(duration).toBeLessThanOrEqual(3.0)
      })
    })
  })

  describe('error handling', () => {
    it('should throw error for empty transcript', () => {
      expect(() => {
        splitter.splitByCharacterLimit('', [], 250)
      }).toThrow('Transcript cannot be empty')
    })

    it('should throw error for invalid character limit', () => {
      expect(() => {
        splitter.splitByCharacterLimit('test', [], 0)
      }).toThrow('Character limit must be positive')
    })

    it('should throw error for mismatched transcript and word timings', () => {
      const transcript = 'Hello world this is a long transcript with many words'
      const wordTimings: WordTiming[] = [{ word: 'Different', startTime: 0, endTime: 0.5 }]

      expect(() => {
        splitter.splitByCharacterLimit(transcript, wordTimings, 250)
      }).toThrow('Word timings do not match transcript')
    })
  })
})
