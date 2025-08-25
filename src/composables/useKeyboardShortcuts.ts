import { onMounted, onUnmounted } from 'vue';
import type { CanvasState } from './useCanvasState';
import type { Box } from '../core/ImageEditor';

/**
 * @description Handles keyboard shortcuts for the editor (e.g., delete, nudge).
 */
export function useKeyboardShortcuts(state: CanvasState) {
  const { imageEditor, slicingMode, selectedBoxId } = state;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!imageEditor.sourceImage) return;

    // Handle Delete and Backspace
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (slicingMode.value === 'grid' && imageEditor.gridArea) {
        e.preventDefault();
        imageEditor.clearGrid();
      } else if (slicingMode.value === 'custom' && selectedBoxId.value !== null) {
        e.preventDefault();
        imageEditor.deleteBox(selectedBoxId.value);
        selectedBoxId.value = null;
      }
    }

    // Handle Arrow Key movement (nudge)
    const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    if (arrowKeys.includes(e.key)) {
      let targetBox: Box | null = null;
      if (slicingMode.value === 'custom' && selectedBoxId.value !== null) {
        targetBox = imageEditor.boxes.find(b => b.id === selectedBoxId.value) || null;
      } else if (slicingMode.value === 'grid' && imageEditor.gridArea) {
        targetBox = imageEditor.gridArea;
      }

      if (targetBox) {
        e.preventDefault();
        const moveAmount = e.shiftKey ? 10 : 1;

        switch (e.key) {
          case 'ArrowUp':
            targetBox.y -= moveAmount;
            break;
          case 'ArrowDown':
            targetBox.y += moveAmount;
            break;
          case 'ArrowLeft':
            targetBox.x -= moveAmount;
            break;
          case 'ArrowRight':
            targetBox.x += moveAmount;
            break;
        }
      }
    }
  };

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  // No return value is needed as this composable only sets up global event listeners
}
