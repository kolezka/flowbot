import type { Logger } from '../logger.js'
import { createHash } from 'node:crypto'
import Anthropic from '@anthropic-ai/sdk'

export type ClassificationLabel = 'safe' | 'spam' | 'scam' | 'toxic' | 'off-topic'

export interface Classification {
  label: ClassificationLabel
  confidence: number
  reason: string
}

interface CacheEntry {
  result: Classification
  expiresAt: number
}

const SYSTEM_PROMPT = `You are a content moderation classifier for a Telegram group chat. Analyze the given message and classify it into exactly one of the following categories:

- "safe" — Normal, acceptable message that follows community guidelines.
- "spam" — Unsolicited promotional content, ads, repetitive messages, or bot-like behavior.
- "scam" — Fraudulent content, phishing attempts, fake offers, or social engineering.
- "toxic" — Hate speech, harassment, threats, slurs, or excessively hostile language.
- "off-topic" — Content clearly unrelated to the group's purpose.

Respond ONLY with a JSON object in this exact format (no markdown, no code fences):
{"label": "<category>", "confidence": <0.0-1.0>, "reason": "<brief explanation>"}

Be conservative: when unsure, classify as "safe" with lower confidence.`

const RATE_LIMIT_MAX_TOKENS = 10
const RATE_LIMIT_REFILL_MS = 60_000
const CACHE_TTL_MS = 5 * 60_000
const CACHE_CLEANUP_INTERVAL_MS = 60_000

const VALID_LABELS = new Set<ClassificationLabel>(['safe', 'spam', 'scam', 'toxic', 'off-topic'])

export class AiClassifierService {
  private client: Anthropic
  private logger: Logger
  private tokens: number
  private lastRefill: number
  private cache = new Map<string, CacheEntry>()
  private cleanupTimer: ReturnType<typeof setInterval> | undefined

  constructor(apiKey: string, logger: Logger) {
    this.client = new Anthropic({ apiKey })
    this.logger = logger.child({ service: 'ai-classifier' })
    this.tokens = RATE_LIMIT_MAX_TOKENS
    this.lastRefill = Date.now()

    this.cleanupTimer = setInterval(() => this.cleanupCache(), CACHE_CLEANUP_INTERVAL_MS)
  }

  async classifyContent(text: string): Promise<Classification> {
    const hash = this.hashContent(text)

    // Check cache
    const cached = this.cache.get(hash)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result
    }

    // Check rate limit
    if (!this.tryConsume()) {
      this.logger.warn('Rate limited, returning safe default')
      return { label: 'safe', confidence: 0, reason: 'rate limited' }
    }

    try {
      const message = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 150,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: text },
        ],
      })

      const content = message.content[0]
      if (content?.type !== 'text') {
        this.logger.warn('Unexpected response type from Claude API')
        return { label: 'safe', confidence: 0, reason: 'unexpected response' }
      }

      const result = this.parseResponse(content.text)

      // Cache the result
      this.cache.set(hash, {
        result,
        expiresAt: Date.now() + CACHE_TTL_MS,
      })

      return result
    }
    catch (error) {
      this.logger.error({ err: error }, 'Claude API classification failed')
      return { label: 'safe', confidence: 0, reason: 'api error' }
    }
  }

  stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }

  private parseResponse(raw: string): Classification {
    try {
      const parsed = JSON.parse(raw)

      const label = VALID_LABELS.has(parsed.label) ? parsed.label as ClassificationLabel : 'safe'
      const confidence = typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0
      const reason = typeof parsed.reason === 'string' ? parsed.reason : 'unknown'

      return { label, confidence, reason }
    }
    catch {
      this.logger.warn({ raw }, 'Failed to parse classification response')
      return { label: 'safe', confidence: 0, reason: 'parse error' }
    }
  }

  private tryConsume(): boolean {
    const now = Date.now()
    const elapsed = now - this.lastRefill
    const refillCount = Math.floor(elapsed / RATE_LIMIT_REFILL_MS) * RATE_LIMIT_MAX_TOKENS

    if (refillCount > 0) {
      this.tokens = Math.min(RATE_LIMIT_MAX_TOKENS, this.tokens + refillCount)
      this.lastRefill = now
    }

    if (this.tokens > 0) {
      this.tokens--
      return true
    }

    return false
  }

  private hashContent(text: string): string {
    const normalized = text.toLowerCase().replace(/\s+/g, '')
    return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
  }

  private cleanupCache() {
    const now = Date.now()
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key)
      }
    }
  }
}
