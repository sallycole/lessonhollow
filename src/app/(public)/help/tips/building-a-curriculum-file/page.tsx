import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Building a Curriculum File — Lesson Hollow Help',
  description:
    'How to create a Lesson Hollow curriculum CSV using a spreadsheet.',
  openGraph: {
    title: 'Building a Curriculum File — Lesson Hollow Help',
    description:
      'How to create a Lesson Hollow curriculum CSV using a spreadsheet.',
    images: [
      {
        url: '/og/lesson-hollow-collage-og.png',
        width: 1200,
        height: 630,
        alt: 'Lesson Hollow Help',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Building a Curriculum File — Lesson Hollow Help',
    description:
      'How to create a Lesson Hollow curriculum CSV using a spreadsheet.',
    images: ['/og/lesson-hollow-collage-og.png'],
  },
}

export default function TipsBuildingCurriculumPage() {
  return (
    <>
      <hgroup>
        <h1>Building a Curriculum File</h1>
        <p>
          You can build a curriculum file using any spreadsheet application that
          exports to CSV. Here is how to do it step by step.
        </p>
      </hgroup>

      <section>
        <h2>1. Choose a spreadsheet application</h2>
        <p>Any of these will work. Use whichever you already have installed.</p>
        <ul>
          <li>LibreOffice Calc</li>
          <li>Google Sheets</li>
          <li>Microsoft Excel</li>
          <li>Apple Numbers</li>
        </ul>
      </section>

      <section>
        <h2>2. Download the template</h2>
        <p>
          This template has the correct format already set up. All you need to
          do is replace the sample data with your own.
        </p>
        <p>
          <a href="/lesson-hollow-template.csv" download role="button" className="outline">
            Save CSV Template
          </a>
        </p>
      </section>

      <section>
        <h2>3. Open the template</h2>
        <p>
          Open the downloaded file in your spreadsheet application. You should
          see two columns. Column A has the field labels and Column B has the
          sample values. The top five rows are curriculum details, followed by a
          blank row, followed by your tasks.
        </p>
      </section>

      <section>
        <h2>4. Fill in your curriculum</h2>
        <p>
          Replace the sample data with your own. Keep the field labels in Column
          A exactly as they are. Here is what goes where:
        </p>
        <dl>
          <dt>Name</dt>
          <dd>Your curriculum name. This is required.</dd>
          <dt>Description</dt>
          <dd>A short description of the curriculum.</dd>
          <dt>Publisher</dt>
          <dd>The author or publisher name.</dd>
          <dt>Grade Level</dt>
          <dd>
            Must be one of: Any, Pre-K, Kindergarten, 1st Grade, 2nd Grade,
            3rd Grade, 4th Grade, 5th Grade, 6th Grade, 7th Grade, 8th Grade,
            9th Grade, 10th Grade, 11th Grade, 12th Grade, College, Adult.
          </dd>
          <dt>Link</dt>
          <dd>A URL for the curriculum (if you have one).</dd>
        </dl>

        <p>For each task row below the blank line, fill in four columns:</p>
        <dl>
          <dt>Title</dt>
          <dd>The task name. Every task needs a title.</dd>
          <dt>Description</dt>
          <dd>What the learner should do for this task.</dd>
          <dt>Action</dt>
          <dd>
            Must be exactly one of: <strong>Read</strong>, <strong>Watch</strong>,{' '}
            <strong>Listen</strong>, or <strong>Do</strong>.
          </dd>
          <dt>URL</dt>
          <dd>A link to the resource for this task (if you have one).</dd>
        </dl>
      </section>

      <section>
        <h2>5. Watch the formatting</h2>
        <p>
          Spreadsheet applications sometimes add formatting that breaks CSV
          files. Before you export, check for these common problems:
        </p>
        <ul>
          <li>
            <strong>Keep cells as plain text.</strong> Do not apply number, date,
            currency, or other cell formats. If your spreadsheet auto-formats a
            value, change the cell format back to plain text.
          </li>
          <li>
            <strong>Do not merge cells.</strong> Every field should live in its
            own single cell.
          </li>
          <li>
            <strong>Do not leave extra content outside the template area.</strong>{' '}
            Delete any notes, comments, or extra columns you may have added
            while working.
          </li>
          <li>
            <strong>Do not delete the blank row</strong> between the curriculum
            details and the task header. The import needs it.
          </li>
          <li>
            <strong>Action values are case-sensitive.</strong> Use Read, not READ
            or read.
          </li>
          <li>
            <strong>Do not rename the column headers.</strong> The task header
            row must be exactly Title, Description, Action, URL.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. Export as CSV</h2>
        <p>Save or export the file in CSV format. The steps vary by application:</p>
        <ul>
          <li>
            <strong>LibreOffice Calc:</strong> File &gt; Save As, choose &quot;Text
            CSV (.csv)&quot; as the file type, and save.
          </li>
          <li>
            <strong>Google Sheets:</strong> File &gt; Download &gt; Comma
            Separated Values (.csv).
          </li>
          <li>
            <strong>Excel:</strong> File &gt; Save As, choose &quot;CSV UTF-8
            (Comma delimited)&quot; as the file type, and save.
          </li>
          <li>
            <strong>Apple Numbers:</strong> File &gt; Export To &gt; CSV, then save.
          </li>
        </ul>
        <p>Give the file a name you will recognize, like ocean-study.csv.</p>
      </section>

      <section>
        <h2>7. Upload to Lesson Hollow</h2>
        <ol>
          <li>
            If you are a Guide, switch to the Player View of the person who will
            study this curriculum. If you are the Player, you are already in the
            right place.
          </li>
          <li>
            Go to the <strong>Curriculums</strong> tab.
          </li>
          <li>
            Click <strong>New Curriculum</strong>.
          </li>
          <li>
            Select the <strong>CSV Upload</strong> tab.
          </li>
          <li>
            Drag your CSV file into the upload area, or click to browse and select
            it.
          </li>
          <li>
            Review the preview. Lesson Hollow will show your curriculum name,
            details, and a list of tasks. If there are errors, it will tell you
            what to fix.
          </li>
          <li>
            Click <strong>Create Curriculum</strong> to finish.
          </li>
        </ol>
      </section>
    </>
  )
}
