import type { WordTiming } from '../schemas/audio'

export interface TranscriptChunk {
  text: string
  startTime: number
  endTime: number
  wordTimings: WordTiming[]
  chunkIndex: number
}

export interface SplitResult {
  chunks: TranscriptChunk[]
  totalChunks: number
  metadata: {
    splitStrategy: string
    averageChunkSize: number
    totalChunks: number
    originalLength: number
  }
}

export class TranscriptSplitter {
  /**
   * Split transcript into chunks with character limit (Argil default: 250)
   */
  splitByCharacterLimit(
    transcript: string,
    wordTimings: WordTiming[],
    maxChars: number
  ): SplitResult {
    this.validateInputs(transcript, wordTimings, maxChars)

    const chunks: TranscriptChunk[] = []

    // Try sentence-aware splitting first if under limit
    const sentences = transcript.split(/(?<=[.!?])\s+/)
    let currentChunk = ''
    let currentWordTimings: WordTiming[] = []
    let wordIndex = 0

    for (const sentence of sentences) {
      const nextChunk = currentChunk ? `${currentChunk} ${sentence}` : sentence

      if (nextChunk.length > maxChars && currentChunk.length > 0) {
        // Save current chunk at sentence boundary
        chunks.push(this.createChunk(currentChunk, currentWordTimings, chunks.length))

        // Start new chunk with current sentence
        currentChunk = sentence
        const sentenceWords = sentence.split(/\s+/)
        currentWordTimings = wordTimings.slice(wordIndex, wordIndex + sentenceWords.length)
        wordIndex += sentenceWords.length
      } else if (sentence.length > maxChars) {
        // Force split long sentence word by word
        const sentenceWords = sentence.split(/\s+/)
        for (const word of sentenceWords) {
          // Handle very long single words by character splitting
          if (word.length > maxChars) {
            let wordPart = word
            while (wordPart.length > 0) {
              const chunk = wordPart.substring(0, maxChars)
              chunks.push(
                this.createChunk(
                  chunk,
                  wordIndex < wordTimings.length ? [wordTimings[wordIndex]] : [],
                  chunks.length
                )
              )
              wordPart = wordPart.substring(maxChars)
            }
            wordIndex++
            continue
          }

          const nextWord = currentChunk ? `${currentChunk} ${word}` : word

          if (nextWord.length > maxChars && currentChunk.length > 0) {
            chunks.push(this.createChunk(currentChunk, currentWordTimings, chunks.length))
            currentChunk = word
            currentWordTimings = wordIndex < wordTimings.length ? [wordTimings[wordIndex]] : []
          } else {
            currentChunk = nextWord
            if (wordIndex < wordTimings.length) {
              currentWordTimings.push(wordTimings[wordIndex])
            }
          }
          wordIndex++
        }
      } else {
        // Add sentence to current chunk
        currentChunk = nextChunk
        const sentenceWords = sentence.split(/\s+/)
        const sentenceWordTimings = wordTimings.slice(wordIndex, wordIndex + sentenceWords.length)
        currentWordTimings.push(...sentenceWordTimings)
        wordIndex += sentenceWords.length
      }
    }

    // Add final chunk if it has content
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk, currentWordTimings, chunks.length))
    }

    return {
      chunks,
      totalChunks: chunks.length,
      metadata: {
        splitStrategy: 'character_limit',
        averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / chunks.length,
        totalChunks: chunks.length,
        originalLength: transcript.length,
      },
    }
  }

  /**
   * Split transcript specifically for Argil (250 char limit, sentence-aware)
   */
  splitForArgil(transcript: string, wordTimings: WordTiming[]): SplitResult {
    // First try sentence-based splitting
    const sentenceResult = this.splitBySentences(transcript, wordTimings)

    // Check if any sentence exceeds 250 chars
    const needsCharacterSplit = sentenceResult.chunks.some((chunk) => chunk.text.length > 250)

    if (!needsCharacterSplit) {
      return {
        ...sentenceResult,
        metadata: {
          ...sentenceResult.metadata,
          splitStrategy: 'sentence_aware_argil',
        },
      }
    }

    // Fall back to character-based splitting
    return this.splitByCharacterLimit(transcript, wordTimings, 250)
  }

  /**
   * Split transcript by sentence boundaries
   */
  splitBySentences(transcript: string, wordTimings: WordTiming[]): SplitResult {
    this.validateInputs(transcript, wordTimings, 1)

    const sentences = transcript.split(/(?<=[.!?])\s+/)
    const chunks: TranscriptChunk[] = []
    let wordIndex = 0

    for (const sentence of sentences) {
      const sentenceWords = sentence.split(/\s+/)
      const sentenceWordTimings = wordTimings.slice(wordIndex, wordIndex + sentenceWords.length)

      chunks.push(this.createChunk(sentence, sentenceWordTimings, chunks.length))

      wordIndex += sentenceWords.length
    }

    return {
      chunks,
      totalChunks: chunks.length,
      metadata: {
        splitStrategy: 'sentence_boundary',
        averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / chunks.length,
        totalChunks: chunks.length,
        originalLength: transcript.length,
      },
    }
  }

  /**
   * Split transcript by time duration segments
   */
  splitByTimeSegments(
    transcript: string,
    wordTimings: WordTiming[],
    maxDuration: number
  ): SplitResult {
    this.validateInputs(transcript, wordTimings, 1)

    const chunks: TranscriptChunk[] = []
    const words = transcript.split(/\s+/)
    let currentWords: string[] = []
    let currentWordTimings: WordTiming[] = []
    let segmentStartTime = 0

    for (let i = 0; i < words.length; i++) {
      const wordTiming = wordTimings[i]
      if (!wordTiming) continue

      const segmentDuration = wordTiming.endTime - segmentStartTime

      if (segmentDuration > maxDuration && currentWords.length > 0) {
        // Save current segment
        chunks.push(this.createChunk(currentWords.join(' '), currentWordTimings, chunks.length))

        // Start new segment
        currentWords = [words[i]]
        currentWordTimings = [wordTiming]
        segmentStartTime = wordTiming.startTime
      } else {
        currentWords.push(words[i])
        currentWordTimings.push(wordTiming)

        if (currentWords.length === 1) {
          segmentStartTime = wordTiming.startTime
        }
      }
    }

    // Add final segment
    if (currentWords.length > 0) {
      chunks.push(this.createChunk(currentWords.join(' '), currentWordTimings, chunks.length))
    }

    return {
      chunks,
      totalChunks: chunks.length,
      metadata: {
        splitStrategy: 'time_segment',
        averageChunkSize: chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / chunks.length,
        totalChunks: chunks.length,
        originalLength: transcript.length,
      },
    }
  }

  /**
   * Create a transcript chunk with proper timing
   */
  private createChunk(text: string, wordTimings: WordTiming[], index: number): TranscriptChunk {
    const startTime = wordTimings.length > 0 ? wordTimings[0].startTime : 0
    const endTime = wordTimings.length > 0 ? wordTimings[wordTimings.length - 1].endTime : 0

    return {
      text: text.trim(),
      startTime,
      endTime,
      wordTimings,
      chunkIndex: index,
    }
  }

  /**
   * Validate inputs for splitting operations
   */
  private validateInputs(transcript: string, wordTimings: WordTiming[], maxChars: number): void {
    if (!transcript || transcript.trim().length === 0) {
      throw new Error('Transcript cannot be empty')
    }

    if (maxChars <= 0) {
      throw new Error('Character limit must be positive')
    }

    // Basic validation that word timings roughly match transcript
    // Remove punctuation for word counting
    const transcriptWords = transcript
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 0).length
    const timingWords = wordTimings.length

    // Allow some tolerance for punctuation and formatting differences
    const tolerance = Math.max(2, Math.floor(transcriptWords * 0.2))

    if (Math.abs(transcriptWords - timingWords) > tolerance) {
      throw new Error('Word timings do not match transcript')
    }
  }
}
