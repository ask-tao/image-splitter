import { ref, nextTick, onMounted, onUnmounted, type Ref } from 'vue';
import type { DropdownInstance } from 'element-plus';
import type { CanvasState } from './useCanvasState';
import type { Box } from '../core/ImageEditor';

/**
 * @description Manages the right-click context menu on the canvas.
 */
export function useContextMenu(
  state: CanvasState,
  canvasRef: Ref<HTMLCanvasElement | null>,
  getBoxAt: (x: number, y: number) => Box | null
) {
  const { imageEditor, slicingMode, selectedBoxId, canvasZoom } = state;

  const dropdownRef = ref<DropdownInstance | null>(null);
  const isMenuVisible = ref(false);
  const menuTop = ref(0);
  const menuLeft = ref(0);
  const rightClickedBoxId = ref<number | null>(null);

  const onRightClick = async (e: MouseEvent) => {
    if (slicingMode.value === 'grid' || !canvasRef.value || !imageEditor.sourceImage) return;

    const rect = canvasRef.value.getBoundingClientRect();
    const x = (e.clientX - rect.left) / (canvasZoom.value / 100);
    const y = (e.clientY - rect.top) / (canvasZoom.value / 100);

    const clickedBox = getBoxAt(x, y);

    if (clickedBox) {
      rightClickedBoxId.value = clickedBox.id;
      menuTop.value = e.clientY;
      menuLeft.value = e.clientX;
      isMenuVisible.value = true;
      await nextTick();
      dropdownRef.value?.handleOpen();
    }
  };

  const closeContextMenu = () => {
    isMenuVisible.value = false;
  };

  const handleVisibleChange = (visible: boolean) => {
    if (!visible) {
      closeContextMenu();
    }
  };

  const handleCommand = (command: string) => {
    if (rightClickedBoxId.value === null) return;

    if (command === 'deleteBox') {
      if (selectedBoxId.value === rightClickedBoxId.value) {
        selectedBoxId.value = null;
      }
      imageEditor.deleteBox(rightClickedBoxId.value);
    }
    // Future commands like 'sendToBack' would be handled here

    closeContextMenu();
  };

  onMounted(() => {
    window.addEventListener('click', closeContextMenu);
  });

  onUnmounted(() => {
    window.removeEventListener('click', closeContextMenu);
  });

  return {
    dropdownRef,
    isMenuVisible,
    menuTop,
    menuLeft,
    onRightClick,
    handleCommand,
    handleVisibleChange,
  };
}
