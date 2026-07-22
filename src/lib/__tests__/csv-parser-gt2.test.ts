import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseCsv } from '../csv-parser'

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf-8')
}

describe('GT 2.0 backwards compatibility', () => {
  it('parses a full GT 2.0 math curriculum using Link instead of Resource URL', () => {
    const csv = loadFixture('gt2-math.csv')
    const result = parseCsv(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.curriculum).toEqual({
      name: 'Saxon Math 5/4',
      description: 'A complete math curriculum for fourth and fifth graders',
      publisher: 'Saxon Publishers',
      grade_level: '5th Grade',
      resource_url: 'https://saxonmath.com/54',
    })
    expect(result.tasks).toHaveLength(5)
    expect(result.tasks[0]).toEqual({
      title: 'Lesson 1',
      description: 'Read chapter 1 and work through practice set A',
      action_type: 'Read',
      resource_url: 'https://saxonmath.com/54/lesson1',
    })
    expect(result.tasks[1].action_type).toBe('Watch')
    expect(result.tasks[2].action_type).toBe('Listen')
    expect(result.tasks[3].action_type).toBe('Do')
    expect(result.tasks[4].action_type).toBe('Read')
  })

  it('parses a minimal GT 2.0 file with only Name and no optional metadata', () => {
    const csv = loadFixture('gt2-reading-minimal.csv')
    const result = parseCsv(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.curriculum.name).toBe('Charlotte Mason Book List')
    expect(result.curriculum.description).toBeUndefined()
    expect(result.curriculum.publisher).toBeUndefined()
    expect(result.curriculum.grade_level).toBeUndefined()
    expect(result.curriculum.resource_url).toBeUndefined()

    expect(result.tasks).toHaveLength(4)
    // First task has no description and no URL
    expect(result.tasks[0].title).toBe('Treasure Island')
    expect(result.tasks[0].description).toBeUndefined()
    expect(result.tasks[0].resource_url).toBeUndefined()
    // Third task has a URL
    expect(result.tasks[2].resource_url).toBe('https://gutenberg.org/wind-in-willows')
    // Fourth task is a Do action
    expect(result.tasks[3].action_type).toBe('Do')
  })

  it('parses a GT 2.0 file with RFC 4180 quoted fields and special characters', () => {
    const csv = loadFixture('gt2-science-quoted.csv')
    const result = parseCsv(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.curriculum.name).toBe('Botany, Zoology, and Nature Study')
    expect(result.curriculum.description).toBe(
      'A year-long science curriculum covering plants, animals, and outdoor observation'
    )
    expect(result.curriculum.publisher).toBe('Apologia Educational Ministries')
    expect(result.curriculum.grade_level).toBe('3rd Grade')
    expect(result.curriculum.resource_url).toBe('https://apologia.com/botany-zoology')

    expect(result.tasks).toHaveLength(5)
    // Quoted title with commas
    expect(result.tasks[0].title).toBe('Unit 1: Seeds, Roots, and Stems')
    // Em-dash in description
    expect(result.tasks[1].description).toContain('collect 5 leaf samples')
    // Escaped double quotes in title
    expect(result.tasks[2].title).toBe('Unit 1 Video: "How Plants Grow"')
    // Task with no URL
    expect(result.tasks[3].resource_url).toBeUndefined()
    // Quoted title with commas in quiz
    expect(result.tasks[4].title).toBe('Quiz: Units 1–2')
  })

  it('handles GT 2.0 files with Windows line endings', () => {
    // Take the math fixture and convert to Windows line endings
    const csv = loadFixture('gt2-math.csv').replace(/\n/g, '\r\n')
    const result = parseCsv(csv)

    expect(result.errors).toHaveLength(0)
    expect(result.curriculum.name).toBe('Saxon Math 5/4')
    expect(result.curriculum.resource_url).toBe('https://saxonmath.com/54')
    expect(result.tasks).toHaveLength(5)
  })

  it('maps Link to resource_url without conflicting with Resource URL', () => {
    // A GT 2.0 file uses "Link", a GT 3.0 file uses "Resource URL" — both should work
    const gt2 = `Name,Test Curriculum\nLink,https://gt2.example.com\n\nTitle,Description,Action,URL\nTask 1,desc,Read,`
    const gt3 = `Name,Test Curriculum\nResource URL,https://gt3.example.com\n\nTitle,Description,Action,URL\nTask 1,desc,Read,`

    const result2 = parseCsv(gt2)
    const result3 = parseCsv(gt3)

    expect(result2.errors).toHaveLength(0)
    expect(result3.errors).toHaveLength(0)
    expect(result2.curriculum.resource_url).toBe('https://gt2.example.com')
    expect(result3.curriculum.resource_url).toBe('https://gt3.example.com')
  })
})
