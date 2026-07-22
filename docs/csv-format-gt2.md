# GT 2.0 CSV Format Specification

This document describes the CSV format used by Gorilla Tasks 2.0 (GT 2.0). Curio's GT 3.0 parser imports GT 2.0 files without modification.

## Overview

A GT 2.0 CSV file has two sections:

1. **Metadata section** — key-value rows describing the curriculum
2. **Task section** — a header row followed by one row per task

The two sections are separated by the task header row (a row starting with `Title`). Blank rows anywhere in the file are ignored.

## Metadata Section

Each metadata row is a two-column key-value pair: the key in column A, the value in column B. Keys are case-insensitive.

| Key | Required | Description |
|-----|----------|-------------|
| `Name` | Yes | Curriculum name |
| `Description` | No | Brief description of the curriculum |
| `Publisher` | No | Publisher or author name |
| `Grade Level` | No | Target grade level (see valid values below) |
| `Link` | No | URL for the curriculum resource |

**Notes:**
- Only `Name` is required. Omitting it produces a parse error.
- Unrecognized keys in the metadata section are silently skipped.
- Extra columns beyond column B are ignored.

### Valid Grade Levels

Grade Level must be one of the following values (case-sensitive):

- `Any`
- `Pre-K`
- `Kindergarten`
- `1st Grade` through `12th Grade`
- `College`
- `Adult`

An invalid grade level produces a validation error.

## Task Section

### Task Header Row

The task section begins with a header row. The parser identifies this row by finding `Title` (case-insensitive) in the first column.

| Column | Required | Description |
|--------|----------|-------------|
| `Title` | Yes | Task title |
| `Description` | No | Task description |
| `Action` | Yes | Action type (see below) |
| `URL` | No | Resource URL for this task |

The column order is determined by the header row — columns can appear in any order as long as the header labels match.

### Task Data Rows

Each row after the task header is a task. Rows with an empty `Title` field are skipped.

### Action Types

The `Action` column accepts the following values (case-insensitive):

- `Read`
- `Watch`
- `Listen`
- `Do`

An invalid or missing action type produces a validation error. The task is still included in parse results (with `Read` as fallback) so it can be displayed in a preview.

## Quoting

Fields follow RFC 4180 CSV quoting rules:

- Fields containing commas, newlines, or double quotes must be wrapped in double quotes
- Embedded double quotes are escaped by doubling them: `""` becomes `"`
- Leading and trailing whitespace in fields is trimmed

## Line Endings

The parser accepts Unix (`\n`), Windows (`\r\n`), and classic Mac (`\r`) line endings.

## Encoding

GT 2.0 files are typically UTF-8. A UTF-8 BOM (`0xEF 0xBB 0xBF`) at the start of the file is tolerated.

## GT 2.0 vs GT 3.0 Differences

| Aspect | GT 2.0 | GT 3.0 |
|--------|--------|--------|
| Curriculum URL key | `Link` | `Resource URL` |
| Format | Identical otherwise | Identical otherwise |

The GT 3.0 parser accepts both `Link` and `Resource URL` as the metadata key for the curriculum URL, so GT 2.0 files import without modification.

## Complete Example

```csv
Name,Saxon Math 5/4
Description,A complete math curriculum for fourth and fifth graders
Publisher,Saxon Publishers
Grade Level,5th Grade
Link,https://example.com/saxon-math

Title,Description,Action,URL
Lesson 1,"Read chapter 1 and work through examples",Read,https://example.com/ch1
Lesson 2,"Watch the instructional video",Watch,https://example.com/vid2
Lesson 3,"Listen to the math podcast episode",Listen,https://example.com/pod3
Lesson 4,"Complete the practice worksheet",Do,https://example.com/ws4
```
