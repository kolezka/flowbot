import { describe, expect, it } from 'vitest'
import { formatDuration, parseDuration } from '../bot/helpers/time.js'

describe('parseDuration', () => {
  it('parses seconds', () => {
    expect(parseDuration('30s')).toBe(30)
  })

  it('parses minutes', () => {
    expect(parseDuration('5m')).toBe(300)
  })

  it('parses hours', () => {
    expect(parseDuration('2h')).toBe(7200)
  })

  it('parses days', () => {
    expect(parseDuration('1d')).toBe(86400)
  })

  it('parses weeks', () => {
    expect(parseDuration('1w')).toBe(604800)
  })

  it('is case-insensitive', () => {
    expect(parseDuration('5M')).toBe(300)
    expect(parseDuration('2H')).toBe(7200)
  })

  it('allows whitespace between number and unit', () => {
    expect(parseDuration('10 m')).toBe(600)
  })

  it('returns null for invalid input', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('abc')).toBeNull()
    expect(parseDuration('10')).toBeNull()
    expect(parseDuration('m')).toBeNull()
    expect(parseDuration('10x')).toBeNull()
  })

  it('returns null for zero duration', () => {
    expect(parseDuration('0s')).toBeNull()
  })

  it('returns null for durations exceeding 30 days', () => {
    expect(parseDuration('31d')).toBeNull()
    expect(parseDuration('5w')).toBeNull()
  })

  it('accepts exactly 30 days', () => {
    expect(parseDuration('30d')).toBe(30 * 86400)
  })
})

describe('formatDuration', () => {
  it('formats seconds', () => {
    expect(formatDuration(45)).toBe('45s')
  })

  it('formats minutes', () => {
    expect(formatDuration(120)).toBe('2m')
    expect(formatDuration(60)).toBe('1m')
  })

  it('formats hours', () => {
    expect(formatDuration(3600)).toBe('1h')
    expect(formatDuration(7200)).toBe('2h')
  })

  it('formats days', () => {
    expect(formatDuration(86400)).toBe('1d')
    expect(formatDuration(172800)).toBe('2d')
  })

  it('floors partial units', () => {
    expect(formatDuration(90)).toBe('1m')
    expect(formatDuration(5400)).toBe('1h')
    expect(formatDuration(100000)).toBe('1d')
  })
})
