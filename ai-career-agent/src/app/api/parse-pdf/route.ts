import { NextRequest, NextResponse } from 'next/server'
import PDFParser from 'pdf2json'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    console.log(`Processing file: ${file.name}, type: ${file.type}, size: ${file.size}`)

    // Handle PDF files
    if (file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        const text = await new Promise<string>((resolve, reject) => {
          const pdfParser = new PDFParser(null, true); // true = raw text content
          
          pdfParser.on("pdfParser_dataError", (errData: Error | { parserError: Error }) => {
            const parserErrorMessage = errData instanceof Error
              ? errData.message
              : errData.parserError?.message || 'Unknown PDF parse error'
            console.error('pdf2json error:', parserErrorMessage)
            reject(new Error(parserErrorMessage))
          })

          pdfParser.on("pdfParser_dataReady", () => {
            try {
              // Extract text from the raw content
              const rawText = pdfParser.getRawTextContent()
              resolve(rawText)
            } catch (e) {
              reject(e)
            }
          })

          // Parse the buffer
          pdfParser.parseBuffer(buffer)
        });

        return NextResponse.json({ text })
      } catch (innerError) {
        console.error('PDF parsing inner error:', innerError)
        return NextResponse.json(
          { error: `PDF Parse Failed: ${innerError instanceof Error ? innerError.message : String(innerError)}` },
          { status: 500 }
        )
      }
    } 
    // Handle Text files
    else if (file.type === 'text/plain') {
      const text = await file.text()
      return NextResponse.json({ text })
    }
    // Unsupported file types
    else {
      return NextResponse.json({ error: 'Unsupported file type. Please upload PDF or TXT.' }, { status: 400 })
    }
  } catch (error) {
    console.error('File parsing global error:', error)
    return NextResponse.json(
      { error: `Failed to parse file: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    )
  }
}
