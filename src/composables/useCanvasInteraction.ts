import { ref, type Ref } from 'vue';
import type { Box } from '../core/ImageEditor';
import type { CanvasState } from './useCanvasState';

const ANCHOR_SIZE = 8;

/**
 * @description Handles user interaction with the canvas via mouse events.
 */
export function useCanvasInteraction(
  state: CanvasState,
  canvasRef: Ref<HTMLCanvasElement | null>,
  getAnchors: (box: Box) => Record<string, { x: number; y: number }>,
) {
  const { imageEditor, slicingMode, selectedBoxId, canvasZoom, cursorStyle } = state;

  const isDrawing = ref(false);
  const isMoving = ref(false);
  const isResizing = ref(false);
  const startX = ref(0);
  const startY = ref(0);
  const offsetX = ref(0);
  const offsetY = ref(0);
  const activeAnchor = ref<string | null>(null);
  const originalAspectRatio = ref(1);

  const getBoxAt = (x: number, y: number): Box | null => {
    // Iterate backwards to select the top-most box
    for (let i = imageEditor.boxes.length - 1; i >= 0; i--) {
      const box = imageEditor.boxes[i];
      if (box.w > 0 && box.h > 0 && x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h) {
        return box;
      }
    }
    return null;
  };

  const getAnchorAt = (x: number, y: number, box: Box): string | null => {
    const anchors = getAnchors(box);
    for (const key in anchors) {
      const anchor = anchors[key as keyof typeof anchors];
      if (x >= anchor.x - ANCHOR_SIZE / 2 && x <= anchor.x + ANCHOR_SIZE / 2 && y >= anchor.y - ANCHOR_SIZE / 2 && y <= anchor.y + ANCHOR_SIZE / 2) {
        return key;
      }
    }
    return null;
  };

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    if (!canvasRef.value || !imageEditor.sourceImage) return;

    const rect = canvasRef.value.getBoundingClientRect();
    startX.value = (e.clientX - rect.left) / (canvasZoom.value / 100);
    startY.value = (e.clientY - rect.top) / (canvasZoom.value / 100);

    const currentMode = slicingMode.value;
    let targetBox: Box | null = null;

    if (currentMode === 'custom') {
      targetBox = imageEditor.boxes.find(b => b.id === selectedBoxId.value) || null;
    } else if (currentMode === 'grid') {
      targetBox = imageEditor.gridArea;
    }

    if (targetBox) {
      const anchor = getAnchorAt(startX.value, startY.value, targetBox);
      if (anchor) {
        isResizing.value = true;
        activeAnchor.value = anchor;
        originalAspectRatio.value = targetBox.w / targetBox.h;
        return;
      }
    }

    if (currentMode === 'custom') {
      const clickedBox = getBoxAt(startX.value, startY.value);
      if (clickedBox) {
        selectedBoxId.value = clickedBox.id;
        isMoving.value = true;
        offsetX.value = startX.value - clickedBox.x;
        offsetY.value = startY.value - clickedBox.y;
      } else {
        selectedBoxId.value = null;
        isDrawing.value = true;
        const newBox = imageEditor.addBox({ x: startX.value, y: startY.value, w: 0, h: 0 });
        selectedBoxId.value = newBox.id;
      }
    } else if (currentMode === 'grid') {
      if (imageEditor.gridArea && startX.value >= imageEditor.gridArea.x && startX.value <= imageEditor.gridArea.x + imageEditor.gridArea.w && startY.value >= imageEditor.gridArea.y && startY.value <= imageEditor.gridArea.y + imageEditor.gridArea.h) {
        isMoving.value = true;
        offsetX.value = startX.value - imageEditor.gridArea.x;
        offsetY.value = startY.value - imageEditor.gridArea.y;
      } else {
        isDrawing.value = true;
        imageEditor.gridArea = { id: Date.now(), x: startX.value, y: startY.value, w: 0, h: 0 };
      }
    }
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!canvasRef.value || !imageEditor.sourceImage) return;
    const rect = canvasRef.value.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / (canvasZoom.value / 100);
    const currentY = (e.clientY - rect.top) / (canvasZoom.value / 100);

    let targetBox: Box | null = null;
    if (slicingMode.value === 'custom') {
      targetBox = imageEditor.boxes.find(b => b.id === selectedBoxId.value) || null;
    } else if (slicingMode.value === 'grid') {
      targetBox = imageEditor.gridArea;
    }

    // Update cursor style
    let cursor = 'default';
    if (targetBox) {
      const anchor = getAnchorAt(currentX, currentY, targetBox);
      if (anchor) {
        if (anchor === 'topLeft' || anchor === 'bottomRight') cursor = 'nwse-resize';
        else if (anchor === 'topRight' || anchor === 'bottomLeft') cursor = 'nesw-resize';
        else if (anchor === 'middleLeft' || anchor === 'middleRight') cursor = 'ew-resize';
        else if (anchor === 'topMiddle' || anchor === 'bottomMiddle') cursor = 'ns-resize';
      } else if (getBoxAt(currentX, currentY) || (slicingMode.value === 'grid' && targetBox && currentX >= targetBox.x && currentX <= targetBox.x + targetBox.w && currentY >= targetBox.y && currentY <= targetBox.y + targetBox.h)) {
        cursor = 'move';
      }
    }
    cursorStyle.value = cursor;

    // Handle moving, resizing, drawing
    if (isResizing.value && targetBox) {
        const originalX = targetBox.x;
        const originalY = targetBox.y;
        const originalW = targetBox.w;
        const originalH = targetBox.h;
        let newX = targetBox.x, newY = targetBox.y, newW = targetBox.w, newH = targetBox.h;
  
        if (e.shiftKey) {
          originalAspectRatio.value = targetBox.w / targetBox.h;
        }
  
        switch (activeAnchor.value) {
            case 'topLeft': {
                newW = originalX + originalW - currentX;
                newH = originalY + originalH - currentY;
                if (e.shiftKey) {
                  if (Math.abs(newW / originalAspectRatio.value - newH) > Math.abs(newH * originalAspectRatio.value - newW)) {
                    newH = newW / originalAspectRatio.value;
                  } else {
                    newW = newH * originalAspectRatio.value;
                  }
                }
                newX = originalX + originalW - newW;
                newY = originalY + originalH - newH;
                break;
              }
              case 'topRight': {
                newW = currentX - originalX;
                newH = originalY + originalH - currentY;
                if (e.shiftKey) {
                  if (Math.abs(newW / originalAspectRatio.value - newH) > Math.abs(newH * originalAspectRatio.value - newW)) {
                    newH = newW / originalAspectRatio.value;
                  } else {
                    newW = newH * originalAspectRatio.value;
                  }
                }
                newY = originalY + originalH - newH;
                break;
              }
              case 'bottomLeft': {
                newW = originalX + originalW - currentX;
                newH = currentY - originalY;
                if (e.shiftKey) {
                  if (Math.abs(newW / originalAspectRatio.value - newH) > Math.abs(newH * originalAspectRatio.value - newW)) {
                    newH = newW / originalAspectRatio.value;
                  } else {
                    newW = newH * originalAspectRatio.value;
                  }
                }
                newX = originalX + originalW - newW;
                break;
              }
              case 'bottomRight': {
                newW = currentX - originalX;
                newH = currentY - originalY;
                if (e.shiftKey) {
                  if (Math.abs(newW / originalAspectRatio.value - newH) > Math.abs(newH * originalAspectRatio.value - newW)) {
                    newH = newW / originalAspectRatio.value;
                  } else {
                    newW = newH * originalAspectRatio.value;
                  }
                }
                break;
              }
            case 'topMiddle': { newY = currentY; newH = originalY + originalH - currentY; break; }
            case 'bottomMiddle': { newH = currentY - originalY; break; }
            case 'middleLeft': { newX = currentX; newW = originalX + originalW - currentX; break; }
            case 'middleRight': { newW = currentX - originalX; break; }
        }
        if (newX < 0) { newW += newX; newX = 0; }
        if (newY < 0) { newH += newY; newY = 0; }
        if (canvasRef.value && newX + newW > canvasRef.value.width) { newW = canvasRef.value.width - newX; }
        if (canvasRef.value && newY + newH > canvasRef.value.height) { newH = canvasRef.value.height - newY; }
        targetBox.x = newX; targetBox.y = newY; targetBox.w = newW; targetBox.h = newH;
    } else if (isMoving.value && targetBox && canvasRef.value) {
      let newX = currentX - offsetX.value;
      let newY = currentY - offsetY.value;
      newX = Math.max(0, Math.min(newX, canvasRef.value.width - targetBox.w));
      newY = Math.max(0, Math.min(newY, canvasRef.value.height - targetBox.h));
      targetBox.x = newX;
      targetBox.y = newY;
    } else if (isDrawing.value) {
      const boxToDraw = slicingMode.value === 'custom' ? imageEditor.boxes[imageEditor.boxes.length - 1] : imageEditor.gridArea;
      if (boxToDraw) {
        boxToDraw.w = currentX - startX.value;
        boxToDraw.h = currentY - startY.value;
      }
    }
  };

  const onMouseUp = () => {
    if (!imageEditor.sourceImage) return;
    let subjectBox: Box | null = null;
    if (slicingMode.value === 'custom' && (isDrawing.value || isResizing.value)) {
      subjectBox = imageEditor.boxes.find(b => b.id === selectedBoxId.value) || null;
    } else if (slicingMode.value === 'grid' && (isDrawing.value || isResizing.value)) {
      subjectBox = imageEditor.gridArea;
    }

    if (subjectBox) {
      // Normalize box dimensions
      if (subjectBox.w < 0) { subjectBox.x += subjectBox.w; subjectBox.w = -subjectBox.w; }
      if (subjectBox.h < 0) { subjectBox.y += subjectBox.h; subjectBox.h = -subjectBox.h; }
      // Delete tiny boxes created by mis-clicks
      if (subjectBox.w < 5 || subjectBox.h < 5) {
        if (slicingMode.value === 'custom') {
          if (isDrawing.value) imageEditor.deleteBox(subjectBox.id);
          selectedBoxId.value = null;
        } else {
          imageEditor.clearGrid();
        }
      }
    }

    isDrawing.value = false;
    isMoving.value = false;
    isResizing.value = false;
    activeAnchor.value = null;
  };

  const onMouseLeave = () => {
    if (isDrawing.value || isMoving.value || isResizing.value) {
      onMouseUp();
    }
  };

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    getBoxAt,
  };
}
