import { NextRequest, NextResponse } from 'next/server'

// Mock data - In a real app, this would be in a shared module
let projects = [
  { id: 'p1', title: 'Villa R+1 Moderne', category: 'Villas', tier: 'premium', price: '350 000 FCFA', status: 'Actif', description: '' },
  { id: 'p2', title: 'Duplex Familial', category: 'Duplex', tier: 'basic', price: '150 000 FCFA', status: 'Actif', description: '' },
  { id: 'p3', title: 'Immeuble R+4', category: 'Immeubles', tier: 'premium', price: '900 000 FCFA', status: 'Brouillon', description: '' },
]

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const project = projects.find((p) => p.id === params.id)

  if (!project) {
    return NextResponse.json(
      { success: false, error: 'Project not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    success: true,
    data: project,
  })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const projectIndex = projects.findIndex((p) => p.id === params.id)

    if (projectIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      )
    }

    projects[projectIndex] = {
      ...projects[projectIndex],
      ...body,
      id: params.id, // Ensure ID doesn't change
    }

    return NextResponse.json({
      success: true,
      data: projects[projectIndex],
      message: 'Project updated successfully',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update project' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectIndex = projects.findIndex((p) => p.id === params.id)

  if (projectIndex === -1) {
    return NextResponse.json(
      { success: false, error: 'Project not found' },
      { status: 404 }
    )
  }

  projects.splice(projectIndex, 1)

  return NextResponse.json({
    success: true,
    message: 'Project deleted successfully',
  })
}
