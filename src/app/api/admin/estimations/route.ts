import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Check if it's a JSON file
    if (!file.name.endsWith('.json')) {
      return NextResponse.json(
        { success: false, error: 'Only JSON files are supported' },
        { status: 400 }
      )
    }

    // Read file content
    const text = await file.text()

    try {
      const jsonData = JSON.parse(text)

      // Process estimation data
      const processedData = {
        id: `est_${Date.now()}`,
        projectId: projectId || 'unknown',
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        data: jsonData,
        // Extract key information from the JSON
        totalAmount: jsonData.total_htva || jsonData.total || 0,
        blocsCount: jsonData.blocs?.length || 0,
      }

      // In production, you would save this to your database
      // For now, we just return success

      return NextResponse.json({
        success: true,
        data: processedData,
        message: 'Estimation uploaded successfully',
      })
    } catch (parseError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON file format' },
        { status: 400 }
      )
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to upload estimation' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const projectId = searchParams.get('projectId')

  // Mock estimations data
  const estimations = [
    {
      id: 'est_1',
      projectId: 'p1',
      fileName: 'Estimation.json',
      uploadedAt: '2024-04-15T10:30:00Z',
      totalAmount: 46000000,
      blocsCount: 8,
      currency: 'XOF',
    },
    {
      id: 'est_2',
      projectId: 'p2',
      fileName: 'Estimation_Villa.json',
      uploadedAt: '2024-04-14T14:20:00Z',
      totalAmount: 32000000,
      blocsCount: 6,
      currency: 'XOF',
    },
  ]

  let filtered = estimations

  if (projectId) {
    filtered = estimations.filter((est) => est.projectId === projectId)
  }

  return NextResponse.json({
    success: true,
    data: filtered,
    total: filtered.length,
  })
}
