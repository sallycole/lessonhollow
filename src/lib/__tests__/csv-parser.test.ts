import { describe, it, expect } from 'vitest'
import { parseCsv } from '../csv-parser'

describe('parseCsv', () => {
  it('parses curriculum metadata and tasks from a valid CSV', () => {
    const csv = `Name,Saxon Math 5/4
Description,A complete math curriculum
Publisher,Saxon Publishers
Grade Level,5th Grade
Resource URL,https://example.com/saxon

Title,Description,Action,URL
Lesson 1,Read chapter 1,Read,https://example.com/ch1
Lesson 2,Watch the video,Watch,https://example.com/vid
Lesson 3,Practice problems,Do,`

    const result = parseCsv(csv)
    expect(result.errors).toHaveLength(0)
    expect(result.curriculum).toEqual({
      name: 'Saxon Math 5/4',
      description: 'A complete math curriculum',
      publisher: 'Saxon Publishers',
      grade_level: '5th Grade',
      resource_url: 'https://example.com/saxon',
    })
    expect(result.tasks).toHaveLength(3)
    expect(result.tasks[0]).toEqual({
      title: 'Lesson 1',
      description: 'Read chapter 1',
      action_type: 'Read',
      resource_url: 'https://example.com/ch1',
    })
    expect(result.tasks[1].action_type).toBe('Watch')
    expect(result.tasks[2].action_type).toBe('Do')
    expect(result.tasks[2].resource_url).toBeUndefined()
  })

  it('handles case-insensitive action types', () => {
    const csv = `Name,Test
Title,Description,Action,URL
Task 1,desc,read,
Task 2,desc,WATCH,
Task 3,desc,listen,
Task 4,desc,DO,`

    const result = parseCsv(csv)
    expect(result.errors).toHaveLength(0)
    expect(result.tasks.map((t) => t.action_type)).toEqual([
      'Read',
      'Watch',
      'Listen',
      'Do',
    ])
  })

  it('reports error for invalid action types', () => {
    const csv = `Name,Test
Title,Description,Action,URL
Task 1,desc,Study,`

    const result = parseCsv(csv)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].field).toBe('Action')
    expect(result.errors[0].message).toContain('"Study"')
    expect(result.errors[0].row).toBe(3)
    // Task still included for preview
    expect(result.tasks).toHaveLength(1)
  })

  it('reports error when curriculum name is missing', () => {
    const csv = `Description,Some desc
Title,Description,Action,URL
Task 1,desc,Read,`

    const result = parseCsv(csv)
    const nameError = result.errors.find((e) => e.field === 'Name')
    expect(nameError).toBeDefined()
    expect(nameError!.message).toContain('required')
  })

  it('reports error for invalid grade level', () => {
    const csv = `Name,Test
Grade Level,Preschool
Title,Description,Action,URL
Task 1,desc,Read,`

    const result = parseCsv(csv)
    const gradeError = result.errors.find((e) => e.field === 'Grade Level')
    expect(gradeError).toBeDefined()
    expect(gradeError!.message).toContain('"Preschool"')
  })

  it('handles RFC 4180 quoted fields with commas', () => {
    const csv = `Name,"Math, Science, and More"
Title,Description,Action,URL
"Task with, comma","Description with ""quotes""",Read,`

    const result = parseCsv(csv)
    expect(result.curriculum.name).toBe('Math, Science, and More')
    expect(result.tasks[0].title).toBe('Task with, comma')
    expect(result.tasks[0].description).toBe('Description with "quotes"')
  })

  it('skips empty rows', () => {
    const csv = `Name,Test

Title,Description,Action,URL

Task 1,desc,Read,

Task 2,desc,Watch,`

    const result = parseCsv(csv)
    expect(result.errors).toHaveLength(0)
    expect(result.tasks).toHaveLength(2)
  })

  it('skips task rows with no title', () => {
    const csv = `Name,Test
Title,Description,Action,URL
Task 1,desc,Read,
,desc,Watch,
Task 3,desc,Do,`

    const result = parseCsv(csv)
    expect(result.tasks).toHaveLength(2)
    expect(result.tasks[0].title).toBe('Task 1')
    expect(result.tasks[1].title).toBe('Task 3')
  })

  it('handles Windows-style line endings', () => {
    const csv = "Name,Test\r\nTitle,Description,Action,URL\r\nTask 1,desc,Read,\r\n"

    const result = parseCsv(csv)
    expect(result.errors).toHaveLength(0)
    expect(result.tasks).toHaveLength(1)
  })

  it('accepts Link as alias for Resource URL', () => {
    const csv = `Name,Test
Link,https://example.com
Title,Description,Action,URL
Task 1,desc,Read,`

    const result = parseCsv(csv)
    expect(result.curriculum.resource_url).toBe('https://example.com')
  })

  it('reports error for missing action type', () => {
    const csv = `Name,Test
Title,Description,Action,URL
Task 1,desc,,`

    const result = parseCsv(csv)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('required')
  })
})
