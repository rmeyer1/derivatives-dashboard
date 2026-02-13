import { CreatePositionRequest } from '@/types/dashboard';

/**
 * Add a new position to the portfolio
 * @param positionData - The position data to add
 * @returns The created position
 */
export async function addPosition(positionData: CreatePositionRequest) {
  const response = await fetch('/api/positions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(positionData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to add position');
  }

  return await response.json();
}

/**
 * Delete a position from the portfolio
 * @param positionId - The ID of the position to delete
 * @returns Success message
 */
export async function deletePosition(positionId: string) {
  const response = await fetch(`/api/positions/${positionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || 'Failed to delete position');
  }

  return await response.json();
}