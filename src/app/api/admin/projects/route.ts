import { NextRequest, NextResponse } from 'next/server'

// Mock data
let projects = [
  { id: 'p1', title: 'Villa R+1 Moderne', category: 'Villas', tier: 'premium', price: '350 000 FCFA', status: 'Actif', description: '' },
  { id: 'p2', title: 'Duplex Familial', category: 'Duplex', tier: 'basic', price: '150 000 FCFA', status: 'Actif', description: '' },
  { id: 'p3', title: 'Immeuble R+4', category: 'Immeubles', tier: 'premium', price: '900 000 FCFA', status: 'Brouillon', description: '' },
]

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search')
  const category = searchParams.get('category')
  const status = searchParams.get('status')

  let filteredProjects = projects

  if (search) {
    const searchLower = search.toLowerCase()
    filteredProjects = filteredProjects.filter(
      (p) => p.title.toLowerCase().includes(searchLower) || p.category.toLowerCase().includes(searchLower)
    )
  }

  if (category) {
    filteredProjects = filteredProjects.filter((p) => p.category === category)
  }

  if (status) {
    filteredProjects = filteredProjects.filter((p) => p.status === status)
  }

  return NextResponse.json({
    success: true,
    data: filteredProjects,
    total: filteredProjects.length,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { title, category, tier, price, description } = body

    if (!title || !category || !tier) {
      return NextResponse.json(
        { success: false, error: 'Title, category, and tier are required' },
        { status: 400 }
      )
    }

    const newProject = {
      id: `p${projects.length + 1}`,
      title,
      category,
      tier,
      price: price || '0 FCFA',
      status: 'Brouillon',
      description: description || '',
    }

    projects.push(newProject)

    return NextResponse.json({
      success: true,
      data: newProject,
      message: 'Project created successfully',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to create project' },
      { status: 500 }
    )
  }
}
