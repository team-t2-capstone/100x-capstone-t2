import { createClient } from '@/utils/supabase/client'

/**
 * Common function to check if a clone is published
 * @param cloneId - The ID of the clone to check
 * @returns Promise<boolean> - True if the clone is published, false otherwise
 */
export async function isClonePublished(cloneId: string): Promise<boolean> {
  try {
    const supabase = createClient()
    
    const { data: clone, error } = await supabase
      .from('clones')
      .select('is_published')
      .eq('id', cloneId)
      .single()

    if (error) {
      console.error('Error checking clone published status:', error)
      return false
    }

    return clone?.is_published || false
  } catch (error) {
    console.error('Unexpected error checking clone published status:', error)
    return false
  }
}

/**
 * Show a popup alert when trying to edit a published clone
 * @param cloneName - Optional name of the clone to include in the message
 */
export function showPublishedCloneAlert(cloneName?: string): void {
  const message = cloneName 
    ? `Clone "${cloneName}" has been published and cannot be edited anymore.`
    : 'This clone has been published and cannot be edited anymore.'
  
  alert(message)
}

/**
 * Check if clone is published and show alert if it is
 * @param cloneId - The ID of the clone to check
 * @param cloneName - Optional name of the clone to include in the message
 * @returns Promise<boolean> - True if clone is NOT published (safe to edit), false if published
 */
export async function checkCloneEditPermission(cloneId: string, cloneName?: string): Promise<boolean> {
  const published = await isClonePublished(cloneId)
  
  if (published) {
    showPublishedCloneAlert(cloneName)
    return false
  }
  
  return true
}

/**
 * Higher-order function that wraps an action with published clone check
 * @param cloneId - The ID of the clone to check
 * @param action - The action to execute if clone is not published
 * @param cloneName - Optional name of the clone to include in the message
 */
export async function withPublishCheck<T>(
  cloneId: string, 
  action: () => T | Promise<T>, 
  cloneName?: string
): Promise<T | null> {
  const canEdit = await checkCloneEditPermission(cloneId, cloneName)
  
  if (!canEdit) {
    return null
  }
  
  return await action()
}

/**
 * Utility type for clone data with published status
 */
export interface CloneWithPublishStatus {
  id: string
  name: string
  is_published: boolean
  published_at?: string
  [key: string]: any
}

/**
 * Helper to determine if any edit action should be disabled
 * @param clone - Clone object with publish status
 * @returns boolean - True if actions should be disabled
 */
export function shouldDisableEdit(clone: CloneWithPublishStatus): boolean {
  return clone.is_published === true
}