// Data formatting helpers

/**
 * Parse JSON response from LLM that may be wrapped in markdown code fences
 * Handles common LLM response formats like ```json...``` or ```...```
 */
export function parseJSONFromLLM(content: string): any {
  if (!content || typeof content !== 'string') {
    throw new Error('Invalid content provided for JSON parsing')
  }

  let cleanContent = content.trim()
  
  // Remove markdown code fences (```json and ```)
  if (cleanContent.startsWith('```json')) {
    cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
  } else if (cleanContent.startsWith('```')) {
    cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
  }
  
  // Remove any remaining whitespace
  cleanContent = cleanContent.trim()
  
  try {
    return JSON.parse(cleanContent)
  } catch (error) {
    throw new Error(`Failed to parse JSON from LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}