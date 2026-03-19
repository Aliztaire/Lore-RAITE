import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx'
import type { Project } from './types'

export async function exportToDocx(project: Project): Promise<Blob> {
  const { outline } = project
  const allSections = [
    outline.introduction,
    ...outline.body,
    outline.conclusion
  ]

  const children: Paragraph[] = []

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: project.title,
          bold: true,
          size: 48,
        }),
      ],
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  )

  // Topic/Abstract placeholder
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: project.topic,
          italics: true,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    })
  )

  // Sections
  for (const section of allSections) {
    // Section heading
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: section.title,
            bold: true,
            size: 32,
          }),
        ],
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 400, after: 200 },
      })
    )

    // Section content
    if (section.content) {
      const paragraphs = section.content.split('\n\n')
      for (const para of paragraphs) {
        if (para.trim()) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: para.trim(),
                  size: 24,
                }),
              ],
              spacing: { after: 200 },
            })
          )
        }
      }
    } else {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: '[No content yet]',
              italics: true,
              color: '888888',
            }),
          ],
          spacing: { after: 200 },
        })
      )
    }

    // References for this section
    if (section.references.length > 0) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'References:',
              bold: true,
              size: 22,
            }),
          ],
          spacing: { before: 200 },
        })
      )

      for (const ref of section.references) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `• ${ref.authors.join(', ')} (${ref.year}). ${ref.title}.`,
                size: 20,
              }),
            ],
            indent: { left: 400 },
          })
        )
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  })

  return Packer.toBlob(doc)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
