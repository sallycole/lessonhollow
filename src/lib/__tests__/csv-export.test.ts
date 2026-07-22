import { describe, it, expect } from 'vitest'
import { generateCsv, sanitizeFilename, UTF8_BOM } from '../csv-export'
import { parseCsv } from '../csv-parser'

describe('generateCsv', () => {
  it('generates CSV with metadata and tasks', () => {
    const csv = generateCsv(
      {
        name: 'Math Basics',
        description: 'Learn basic math',
        publisher: 'Acme Publishing',
        grade_level: '3rd Grade',
        resource_url: 'https://example.com/math',
      },
      [
        { title: 'Addition', description: 'Learn to add', action_type: 'Read', resource_url: 'https://example.com/add' },
        { title: 'Subtraction', description: null, action_type: 'Do', resource_url: null },
      ]
    )

    expect(csv).toContain('Name,Math Basics')
    expect(csv).toContain('Description,Learn basic math')
    expect(csv).toContain('Publisher,Acme Publishing')
    expect(csv).toContain('Grade Level,3rd Grade')
    expect(csv).toContain('Link,https://example.com/math')
    expect(csv).toContain('Title,Description,Action,URL')
    expect(csv).toContain('Addition,Learn to add,Read,https://example.com/add')
    expect(csv).toContain('Subtraction,,Do,')
  })

  it('handles empty/null metadata fields as empty strings', () => {
    const csv = generateCsv(
      { name: 'Minimal', description: null, publisher: null, grade_level: null, resource_url: null },
      []
    )

    expect(csv).toContain('Name,Minimal')
    expect(csv).toContain('Description,')
    expect(csv).toContain('Publisher,')
    expect(csv).toContain('Grade Level,')
    expect(csv).toContain('Link,')
    // Should still have task header even with no tasks
    expect(csv).toContain('Title,Description,Action,URL')
  })

  it('quotes fields containing commas', () => {
    const csv = generateCsv(
      { name: 'Math, Science, and Art' },
      [{ title: 'Task with, comma', description: null, action_type: 'Read', resource_url: null }]
    )

    expect(csv).toContain('Name,"Math, Science, and Art"')
    expect(csv).toContain('"Task with, comma"')
  })

  it('quotes fields containing double quotes and escapes them', () => {
    const csv = generateCsv(
      { name: 'The "Best" Curriculum' },
      [{ title: 'Read "Chapter 1"', description: null, action_type: 'Read', resource_url: null }]
    )

    expect(csv).toContain('Name,"The ""Best"" Curriculum"')
    expect(csv).toContain('"Read ""Chapter 1"""')
  })

  it('quotes fields containing newlines', () => {
    const csv = generateCsv(
      { name: 'Normal Name' },
      [{ title: 'Multi\nline title', description: null, action_type: 'Do', resource_url: null }]
    )

    expect(csv).toContain('"Multi\nline title"')
  })

  it('uses CRLF line endings', () => {
    const csv = generateCsv({ name: 'Test' }, [])
    const lines = csv.split('\r\n')
    // Should have: Name, Description, Publisher, Grade Level, Link, blank, Title header, trailing
    expect(lines.length).toBeGreaterThanOrEqual(8)
  })

  it('round-trips through import parser', () => {
    const curriculum = {
      name: 'Round Trip Test',
      description: 'A test curriculum',
      publisher: 'Test Publisher',
      grade_level: '5th Grade',
      resource_url: 'https://example.com',
    }
    const tasks = [
      { title: 'Task One', description: 'First task', action_type: 'Read', resource_url: 'https://example.com/1' },
      { title: 'Task Two', description: null, action_type: 'Watch', resource_url: null },
      { title: 'Task Three', description: 'With commas, in description', action_type: 'Do', resource_url: null },
    ]

    const csv = generateCsv(curriculum, tasks)
    const parsed = parseCsv(csv)

    expect(parsed.errors).toHaveLength(0)
    expect(parsed.curriculum.name).toBe('Round Trip Test')
    expect(parsed.curriculum.description).toBe('A test curriculum')
    expect(parsed.curriculum.publisher).toBe('Test Publisher')
    expect(parsed.curriculum.grade_level).toBe('5th Grade')
    expect(parsed.curriculum.resource_url).toBe('https://example.com')
    expect(parsed.tasks).toHaveLength(3)
    expect(parsed.tasks[0].title).toBe('Task One')
    expect(parsed.tasks[0].description).toBe('First task')
    expect(parsed.tasks[0].action_type).toBe('Read')
    expect(parsed.tasks[0].resource_url).toBe('https://example.com/1')
    expect(parsed.tasks[1].title).toBe('Task Two')
    expect(parsed.tasks[1].action_type).toBe('Watch')
    expect(parsed.tasks[2].title).toBe('Task Three')
    expect(parsed.tasks[2].description).toBe('With commas, in description')
  })
})

describe('sanitizeFilename', () => {
  it('converts spaces to hyphens and lowercases', () => {
    expect(sanitizeFilename('Math Basics')).toBe('math-basics')
  })

  it('removes special characters', () => {
    expect(sanitizeFilename('My Curriculum! @#$%')).toBe('my-curriculum')
  })

  it('collapses multiple hyphens', () => {
    expect(sanitizeFilename('A - B - C')).toBe('a---b---c'.replace(/--+/g, '-'))
  })

  it('truncates to 80 characters', () => {
    const long = 'a'.repeat(100)
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(80)
  })

  it('returns "curriculum" for empty/all-special input', () => {
    expect(sanitizeFilename('!@#$%')).toBe('curriculum')
    expect(sanitizeFilename('')).toBe('curriculum')
  })
})

describe('UTF8_BOM', () => {
  it('is the correct BOM character', () => {
    expect(UTF8_BOM).toBe('\uFEFF')
  })
})
