import { watch } from 'vue';
import type { Ref } from 'vue';
import type { CanvasState } from './useCanvasState';

/**
 * @description Manages the auto-detection logic for finding sprites.
 */
export function useAutoDetect(
  state: CanvasState,
  canvasRef: Ref<HTMLCanvasElement | null>
) {
  const { imageEditor, autoDetectMode, autoDetectPadding, canvasPadding, selectedBoxId } = state;

  const reapplyAutoDetect = () => {
    const canvas = canvasRef.value;
    if (!canvas || !imageEditor.sourceImage) return;

    // Use a temporary canvas to get image data without affecting the main display
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    tempCanvas.width = imageEditor.sourceImage.width;
    tempCanvas.height = imageEditor.sourceImage.height;
    tempCtx.drawImage(imageEditor.sourceImage, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);

    if (autoDetectMode.value === 'padding') {
      imageEditor.autoDetect(imageData, autoDetectPadding.value, canvasPadding.value);
    } else if (autoDetectMode.value === 'fixedSize') {
      const shouldSetFixedSize = imageEditor.selectionWidth == null || imageEditor.selectionHeight == null;
      imageEditor.autoDetect(imageData, 0, canvasPadding.value, shouldSetFixedSize);
    }
  };

  const handleAutoDetect = () => {
    reapplyAutoDetect();
    selectedBoxId.value = null;
  };

  watch(autoDetectPadding, () => {
    if (autoDetectMode.value === 'padding') {
      reapplyAutoDetect();
    }
  });

  // Persist last selection dimensions when switching away from fixedSize mode
  let lastSelectionWidth: number | undefined;
  let lastSelectionHeight: number | undefined;

  watch(autoDetectMode, (newMode, oldMode) => {
    if (newMode === 'padding') {
      lastSelectionWidth = imageEditor.selectionWidth;
      lastSelectionHeight = imageEditor.selectionHeight;
      imageEditor.selectionWidth = undefined;
      imageEditor.selectionHeight = undefined;
    } else if (newMode === 'fixedSize') {
      imageEditor.selectionWidth = lastSelectionWidth;
      imageEditor.selectionHeight = lastSelectionHeight;
    }
    if (newMode !== oldMode) {
      reapplyAutoDetect();
    }
  });

  watch([() => imageEditor.selectionWidth, () => imageEditor.selectionHeight], (newValues) => {
    const [newWidth, newHeight] = newValues;
    if (newWidth === null) imageEditor.selectionWidth = undefined;
    if (newHeight === null) imageEditor.selectionHeight = undefined;
    
    if (autoDetectMode.value === 'fixedSize') {
      reapplyAutoDetect();
    }
  });

  return {
    handleAutoDetect,
  };
}
