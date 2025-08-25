import { ref, watch, computed, toRefs } from 'vue';
import { ElMessageBox } from 'element-plus';
import { useI18n } from 'vue-i18n';
import { useCanvasState } from './useCanvasState';
import { useCanvasDrawing } from './useCanvasDrawing';
import { useCanvasInteraction } from './useCanvasInteraction';
import { useContextMenu } from './useContextMenu';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { useFileHandling } from './useFileHandling';
import { useAutoDetect } from './useAutoDetect';

/**
 * @description The main composable for the image editor.
 * It integrates all other composables and provides a unified interface to the UI.
 */
export function useImageEditor() {
  const { t } = useI18n();

  // --- Template Refs ---
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  const previewCanvasRef = ref<HTMLCanvasElement | null>(null);

  // 1. --- State Management ---
  const state = useCanvasState();
  const { imageEditor, slicingMode, canvasZoom, canvasPadding, selectedBoxId } = state;

  // 2. --- Drawing ---
  const { setupCanvas, getAnchors } = useCanvasDrawing(state, canvasRef, previewCanvasRef);

  // 3. --- Canvas Interaction ---
  const { onMouseDown, onMouseMove, onMouseUp, onMouseLeave, getBoxAt } = useCanvasInteraction(state, canvasRef, getAnchors);

  // 4. --- Context Menu ---
  const { dropdownRef, isMenuVisible, menuTop, menuLeft, onRightClick, handleCommand, handleVisibleChange } = useContextMenu(state, canvasRef, getBoxAt);

  // 5. --- Keyboard Shortcuts ---
  useKeyboardShortcuts(state);

  // 6. --- File Handling ---
  const { handleFileChange, handleExport, onDrop } = useFileHandling(state, setupCanvas);

  // 7. --- Auto-detection ---
  const { handleAutoDetect } = useAutoDetect(state, canvasRef);

  // --- Computed Properties ---
  const fileNamePreview = computed(() => {
    return `${state.exportPrefix.value}${state.exportConnector.value}1.png`;
  });

  // --- Watchers that orchestrate multiple composables ---
  watch(canvasPadding, (newPadding) => {
    if (imageEditor.sourceImage) setupCanvas(imageEditor.sourceImage);
  });

  watch(canvasZoom, (newZoom) => {
    if (canvasRef.value && imageEditor.sourceImage) {
      canvasRef.value.style.width = `${(imageEditor.sourceImage.width + canvasPadding.value * 2) * (newZoom / 100)}px`;
      canvasRef.value.style.height = `${(imageEditor.sourceImage.height + canvasPadding.value * 2) * (newZoom / 100)}px`;
    }
  });

  // Confirmation dialog when switching slicing mode with existing work
  let isRevertingSlicingMode = false;
  watch(slicingMode, (newMode, oldMode) => {
    if (isRevertingSlicingMode) {
      isRevertingSlicingMode = false;
      return;
    }
    const hasWorkInProgress = imageEditor.boxes.length > 0 || imageEditor.gridArea;
    if (!hasWorkInProgress) {
      imageEditor.clearBoxes();
      selectedBoxId.value = null;
      imageEditor.clearGrid();
      return;
    }

    ElMessageBox.confirm(
      t('messages.switchModeConfirmMsg'),
      t('messages.clearAllConfirmTitle'),
      {
        confirmButtonText: t('messages.confirm'),
        cancelButtonText: t('messages.cancel'),
        type: 'warning',
      }
    ).then(() => {
      imageEditor.clearBoxes();
      selectedBoxId.value = null;
      imageEditor.clearGrid();
    }).catch(() => {
      isRevertingSlicingMode = true;
      slicingMode.value = oldMode;
    });
  });

  const handleClearAll = () => {
    if (imageEditor.boxes.length === 0 && !imageEditor.gridArea) return;

    ElMessageBox.confirm(t('messages.clearAllConfirmMsg'), t('messages.clearAllConfirmTitle'), {
      confirmButtonText: t('messages.confirm'),
      cancelButtonText: t('messages.cancel'),
      type: 'warning',
    }).then(() => {
      imageEditor.clearBoxes();
      selectedBoxId.value = null;
      imageEditor.clearGrid();
    }).catch(() => {});
  };

  return {
    // Template Refs
    canvasRef,
    previewCanvasRef,
    dropdownRef,

    // State (from useCanvasState, exposing to the template)
    ...state,
    ...toRefs(imageEditor),

    // Computed
    fileNamePreview,

    // Context Menu State
    isMenuVisible,
    menuTop,
    menuLeft,

    // UI Action Handlers
    handleFileChange,
    onDrop,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onRightClick,
    handleCommand,
    handleVisibleChange,
    handleClearAll,
    handleAutoDetect,
    handleExport,
    fitGridToImage: () => imageEditor.fitGridToImage(canvasPadding.value),
    clearGrid: imageEditor.clearGrid,
  };
}

export type UseImageEditorReturn = ReturnType<typeof useImageEditor>;
