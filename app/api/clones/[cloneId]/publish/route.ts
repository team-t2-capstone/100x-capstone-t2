import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { cloneId: string } }
) {
  try {
    const { cloneId } = await params
    
    // Create Supabase server client
    const supabase = await createClient()
    
    // Get the current user from the session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required', message: 'You must be logged in to publish a clone' },
        { status: 401 }
      )
    }

    // Verify the clone exists and belongs to the user
    const { data: clone, error: cloneError } = await supabase
      .from('clones')
      .select('id, creator_id, is_published, name')
      .eq('id', cloneId)
      .single()

    if (cloneError) {
      console.error('Error fetching clone:', cloneError)
      return NextResponse.json(
        { error: 'Clone not found', message: 'The specified clone could not be found' },
        { status: 404 }
      )
    }

    // Check if user owns the clone
    if (clone.creator_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You can only publish your own clones' },
        { status: 403 }
      )
    }

    // Check if already published
    if (clone.is_published) {
      return NextResponse.json(
        { error: 'Already published', message: 'This clone has already been published' },
        { status: 400 }
      )
    }

    // Update the clone to published status
    const { error: updateError } = await supabase
      .from('clones')
      .update({ 
        is_published: true,
        published_at: new Date().toISOString()
      })
      .eq('id', cloneId)

    if (updateError) {
      console.error('Error publishing clone:', updateError)
      return NextResponse.json(
        { error: 'Update failed', message: 'Failed to publish the clone. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { 
        success: true, 
        message: `Clone "${clone.name}" has been published successfully!`,
        clone: {
          id: cloneId,
          is_published: true,
          published_at: new Date().toISOString()
        }
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Unexpected error in publish clone endpoint:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    )
  }
}