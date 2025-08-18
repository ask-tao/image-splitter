
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue';
import type { UploadFile, DropdownInstance } from 'element-plus';
import { ElMessageBox } from 'element-plus';
import JSZip from 'jszip';

// Data Structures
export interface Box {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function useImageEditor() {
  const canvasRef = ref<HTMLCanvasElement | null>(null);
  const previewCanvasRef = ref<HTMLCanvasElement | null>(null);
  const ctxRef = ref<CanvasRenderingContext2D | null>(null);
  const sourceImage = ref<HTMLImageElement | null>(null);

  const boxes = ref<Box[]>([]);
  const selectedBoxId = ref<number | null>(null);

  // Interaction State
  const isDrawing = ref(false);
  const isMoving = ref(false);
  const isResizing = ref(false);
  const startX = ref(0);
  const startY = ref(0);
  const offsetX = ref(0);
  const offsetY = ref(0);
  const activeAnchor = ref<string | null>(null);
  const originalAspectRatio = ref(1);
  const cursorStyle = ref('default');

  const fileInputRef = ref<HTMLInputElement | null>(null);

  // Mode State
  const slicingMode = ref('custom'); // 'custom' or 'grid'
  const gridRows = ref(2);
  const gridCols = ref(2);
  const gridArea = ref<Box | null>(null);

  watch(slicingMode, () => {
    // Clear all boxes and selections when mode changes
    boxes.value = [];
    selectedBoxId.value = null;
    gridArea.value = null;
    draw();
  });

  watch([gridRows, gridCols], () => {
    if (slicingMode.value === 'grid') {
      draw();
    }
  });

  const fitGridToImage = () => {
    if (!sourceImage.value) return;
    gridArea.value = {
      id: Date.now(),
      x: canvasPadding.value,
      y: canvasPadding.value,
      w: sourceImage.value.width,
      h: sourceImage.value.height,
    };
    draw();
  };

  const clearGrid = () => {
    if (!gridArea.value) return;
    ElMessageBox.confirm('此操作将清除网格，是否继续？', '警告', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }).then(() => {
      gridArea.value = null;
      draw();
    }).catch(() => { });
  };


  const onCanvasPlaceholderClick = () => {
    fileInputRef.value?.click();
  };

  const onFileSelected = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      const uploadFile = { raw: target.files[0] } as UploadFile;
      handleFileChange(uploadFile);
    }
  };

  const onDrop = (e: DragEvent) => {
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      const uploadFile = { raw: e.dataTransfer.files[0] } as UploadFile;
      handleFileChange(uploadFile);
    }
  };

  // Context Menu State
  const dropdownRef = ref<DropdownInstance | null>(null);
  const isMenuVisible = ref(false);
  const menuTop = ref(0);
  const menuLeft = ref(0);
  const rightClickedBoxId = ref<number | null>(null);

  const closeContextMenu = () => {
    isMenuVisible.value = false;
  };

  const handleVisibleChange = (visible: boolean) => {
    if (!visible) {
      closeContextMenu();
    }
  };

  // --- Lifecycle Hooks ---
  onMounted(() => {
    const canvas = canvasRef.value;
    if (canvas) {
      ctxRef.value = canvas.getContext('2d');
    }
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', closeContextMenu);
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('click', closeContextMenu);
  });

  // --- Drawing and Preview ---
  const ANCHOR_SIZE = 8;
  const ANCHOR_COLOR = '#ffffff';
  const ANCHOR_STROKE_COLOR = '#007bff';

  const canvasZoom = ref(100); // 100% zoom
  const canvasPadding = ref(20); // Make canvas padding adjustable

  watch(canvasPadding, (newValue) => {
    if (sourceImage.value) {
      const canvas = canvasRef.value;
      if (canvas) {
        canvas.width = sourceImage.value.width + newValue * 2;
        canvas.height = sourceImage.value.height + newValue * 2;
        // Update canvas style dimensions based on current zoom
        canvas.style.width = `${canvas.width * (canvasZoom.value / 100)}px`;
        canvas.style.height = `${canvas.height * (canvasZoom.value / 100)}px`;
        draw();
        updatePreview();
      }
    }
  });

  watch(canvasZoom, (newValue) => {
    const canvas = canvasRef.value;
    if (canvas && sourceImage.value) {
      // Update canvas style dimensions based on new zoom
      canvas.style.width = `${(sourceImage.value.width + canvasPadding.value * 2) * (newValue / 100)}px`;
      canvas.style.height = `${(sourceImage.value.height + canvasPadding.value * 2) * (newValue / 100)}px`;
      draw(); // Redraw to apply new zoom
    }
  });

  const autoDetectPadding = ref(0);

  watch(autoDetectPadding, () => {
    if (sourceImage.value && boxes.value.length > 0) {
      handleAutoDetect();
    }
  });
  const exportPrefix = ref('sprite');
  const exportConnector = ref('_');

  const fileNamePreview = computed(() => {
    return `${exportPrefix.value}${exportConnector.value}1.png`;
  });

  const getAnchors = (box: Box) => {
    return {
      topLeft: { x: box.x, y: box.y },
      topMiddle: { x: box.x + box.w / 2, y: box.y },
      topRight: { x: box.x + box.w, y: box.y },
      middleLeft: { x: box.x, y: box.y + box.h / 2 },
      middleRight: { x: box.x + box.w, y: box.y + box.h / 2 },
      bottomLeft: { x: box.x, y: box.y + box.h },
      bottomMiddle: { x: box.x + box.w / 2, y: box.y + box.h },
      bottomRight: { x: box.x + box.w, y: box.y + box.h },
    };
  };

  const draw = () => {
    const canvas = canvasRef.value;
    const ctx = ctxRef.value;
    if (!canvas || !ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (sourceImage.value) {
      // Draw image at 1:1 scale
      ctx.drawImage(sourceImage.value, canvasPadding.value, canvasPadding.value);

      if (slicingMode.value === 'custom') {
        boxes.value.forEach(box => {
          const isSelected = box.id === selectedBoxId.value;
          ctx.lineWidth = 2; // Use constant line width
          ctx.strokeStyle = isSelected ? '#007bff' : '#FF0000';
          ctx.strokeRect(box.x, box.y, box.w, box.h);

          if (isSelected) {
            ctx.fillStyle = ANCHOR_COLOR;
            ctx.strokeStyle = ANCHOR_STROKE_COLOR;
            ctx.lineWidth = 2; // Use constant line width
            const anchors = getAnchors(box);
            for (const key in anchors) {
              const anchor = anchors[key as keyof typeof anchors];
              // Draw anchors at constant size
              ctx.fillRect(anchor.x - ANCHOR_SIZE / 2, anchor.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
              ctx.strokeRect(anchor.x - ANCHOR_SIZE / 2, anchor.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
            }
          }
        });
      } else if (slicingMode.value === 'grid') {
        if (gridArea.value) {
          const box = gridArea.value;
          // Draw main grid area
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#007bff'; // Blue for grid area
          ctx.strokeRect(box.x, box.y, box.w, box.h);

          // Draw grid lines
          ctx.strokeStyle = '#007bff'; // Blue for grid lines
          ctx.lineWidth = 0;
          ctx.setLineDash([4, 4]);

          const cellWidth = box.w / gridCols.value;
          for (let i = 1; i < gridCols.value; i++) {
            ctx.beginPath();
            ctx.moveTo(box.x + i * cellWidth, box.y);
            ctx.lineTo(box.x + i * cellWidth, box.y + box.h);
            ctx.stroke();
          }

          const cellHeight = box.h / gridRows.value;
          for (let i = 1; i < gridRows.value; i++) {
            ctx.beginPath();
            ctx.moveTo(box.x, box.y + i * cellHeight);
            ctx.lineTo(box.x + box.w, box.y + i * cellHeight);
            ctx.stroke();
          }
          ctx.setLineDash([]); // Reset line dash

          // Draw anchors on top
          ctx.fillStyle = ANCHOR_COLOR;
          ctx.strokeStyle = ANCHOR_STROKE_COLOR;
          ctx.lineWidth = 2;
          const anchors = getAnchors(box);
          for (const key in anchors) {
            const anchor = anchors[key as keyof typeof anchors];
            ctx.fillRect(anchor.x - ANCHOR_SIZE / 2, anchor.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
            ctx.strokeRect(anchor.x - ANCHOR_SIZE / 2, anchor.y - ANCHOR_SIZE / 2, ANCHOR_SIZE, ANCHOR_SIZE);
          }
        }
      }
    }
  };

  const updatePreview = () => {
    const previewCanvas = previewCanvasRef.value;
    if (!previewCanvas || !sourceImage.value) return;

    const container = previewCanvas.parentElement;
    if (!container) return;

    // Match canvas buffer size to container size
    previewCanvas.width = container.clientWidth;
    previewCanvas.height = container.clientHeight;

    const previewCtx = previewCanvas.getContext('2d');
    if (!previewCtx) return;

    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

    if (slicingMode.value === 'grid') {
      return; // No preview for grid mode for now
    }

    const selectedBox = boxes.value.find(b => b.id === selectedBoxId.value);

    if (selectedBox && selectedBox.w > 0 && selectedBox.h > 0) {
      // Calculate dimensions to draw while maintaining aspect ratio
      const aspectRatio = selectedBox.w / selectedBox.h;
      let drawW = previewCanvas.width;
      let drawH = drawW / aspectRatio;

      if (drawH > previewCanvas.height) {
        drawH = previewCanvas.height;
        drawW = drawH * aspectRatio;
      }

      // Center the image within the canvas
      const drawX = (previewCanvas.width - drawW) / 2;
      const drawY = (previewCanvas.height - drawH) / 2;

      previewCtx.drawImage(
        sourceImage.value,
        selectedBox.x - canvasPadding.value, selectedBox.y - canvasPadding.value, selectedBox.w, selectedBox.h, // Source rect
        drawX, drawY, drawW, drawH // Destination rect (aspect-ratio corrected)
      );
    }
  };

  // --- Event Handlers ---
  const handleFileChange = (uploadFile: UploadFile) => {
    if (!uploadFile.raw || !uploadFile.raw.type.startsWith('image')) return;

    const loadImage = () => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(uploadFile.raw!);
      img.src = objectUrl;

      img.onload = () => {
        const canvas = canvasRef.value;
        if (!canvas) return;

        sourceImage.value = img;
        canvas.width = img.width + canvasPadding.value * 2;
        canvas.height = img.height + canvasPadding.value * 2;
        canvas.style.width = `${canvas.width * (canvasZoom.value / 100)}px`;
        canvas.style.height = `${canvas.height * (canvasZoom.value / 100)}px`;

        boxes.value = [];
        selectedBoxId.value = null;
        gridArea.value = null;
        draw();
        updatePreview();
        URL.revokeObjectURL(objectUrl);
      };
    };

    if (sourceImage.value) {
      ElMessageBox.confirm('这会替换掉当前图片和所有选框，是否继续？', '警告', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
      }).then(() => {
        loadImage();
      }).catch(() => { });
    } else {
      loadImage();
    }
  };

  const getBoxAt = (x: number, y: number): Box | null => {
    for (let i = boxes.value.length - 1; i >= 0; i--) {
      const box = boxes.value[i];
      // Ignore zero-sized boxes to prevent ghost selection.
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
      if (
        x >= anchor.x - ANCHOR_SIZE / 2 && x <= anchor.x + ANCHOR_SIZE / 2 &&
        y >= anchor.y - ANCHOR_SIZE / 2 && y <= anchor.y + ANCHOR_SIZE / 2
      ) {
        return key;
      }
    }
    return null;
  };

  const onMouseDown = (e: MouseEvent) => {
    if (isMenuVisible.value) closeContextMenu();
    e.preventDefault();
    if (!canvasRef.value || !sourceImage.value) return;

    const rect = canvasRef.value.getBoundingClientRect();
    startX.value = (e.clientX - rect.left) / (canvasZoom.value / 100);
    startY.value = (e.clientY - rect.top) / (canvasZoom.value / 100);

    if (slicingMode.value === 'custom') {
      const selectedBox = boxes.value.find(b => b.id === selectedBoxId.value);
      if (selectedBox) {
        const anchor = getAnchorAt(startX.value, startY.value, selectedBox);
        if (anchor) {
          isResizing.value = true;
          activeAnchor.value = anchor;
          originalAspectRatio.value = selectedBox.w / selectedBox.h;
          return;
        }
      }

      const clickedBox = getBoxAt(startX.value, startY.value);
      if (clickedBox) {
        const clickedBoxIndex = boxes.value.findIndex(b => b.id === clickedBox.id);
        if (clickedBoxIndex !== -1) {
          const [boxToMove] = boxes.value.splice(clickedBoxIndex, 1);
          boxes.value.push(boxToMove);
        }
        selectedBoxId.value = clickedBox.id;
        isMoving.value = true;
        offsetX.value = startX.value - clickedBox.x;
        offsetY.value = startY.value - clickedBox.y;
      } else {
        selectedBoxId.value = null;
        isDrawing.value = true;
        const newBox: Box = { id: Date.now(), x: startX.value, y: startY.value, w: 0, h: 0 };
        boxes.value.push(newBox);
      }
    } else if (slicingMode.value === 'grid') {
      if (gridArea.value) {
        const anchor = getAnchorAt(startX.value, startY.value, gridArea.value);
        if (anchor) {
          isResizing.value = true;
          activeAnchor.value = anchor;
          originalAspectRatio.value = gridArea.value.w / gridArea.value.h;
          return;
        }
        if (startX.value >= gridArea.value.x && startX.value <= gridArea.value.x + gridArea.value.w &&
          startY.value >= gridArea.value.y && startY.value <= gridArea.value.y + gridArea.value.h) {
          isMoving.value = true;
          offsetX.value = startX.value - gridArea.value.x;
          offsetY.value = startY.value - gridArea.value.y;
          return;
        }
      }
      if (!gridArea.value) {
        isDrawing.value = true;
        gridArea.value = { id: Date.now(), x: startX.value, y: startY.value, w: 0, h: 0 };
      }
    }
    draw();
    updatePreview();
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!canvasRef.value || !sourceImage.value) return;
    const rect = canvasRef.value.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / (canvasZoom.value / 100);
    const currentY = (e.clientY - rect.top) / (canvasZoom.value / 100);

    let targetBox: Box | null = null;
    if (slicingMode.value === 'custom') {
      targetBox = boxes.value.find(b => b.id === selectedBoxId.value) || null;
    } else if (slicingMode.value === 'grid') {
      targetBox = gridArea.value;
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

    // Handle moving and resizing
    if (isResizing.value && targetBox) {
      const originalX = targetBox.x;
      const originalY = targetBox.y;
      const originalW = targetBox.w;
      const originalH = targetBox.h;
      let newX = targetBox.x, newY = targetBox.y, newW = targetBox.w, newH = targetBox.h;

      switch (activeAnchor.value) {
        case 'topLeft': {
          newX = currentX;
          newY = currentY;
          newW = originalX + originalW - currentX;
          newH = originalY + originalH - currentY;

          if (originalAspectRatio.value !== 0) {
            const newAspectRatio = newW / newH;
            if (newAspectRatio > originalAspectRatio.value) {
              newW = newH * originalAspectRatio.value;
              newX = originalX + originalW - newW;
            } else if (newAspectRatio < originalAspectRatio.value) {
              newH = newW / originalAspectRatio.value;
              newY = originalY + originalH - newH;
            }
          }
          break;
        }
        case 'topRight': {
          newW = currentX - originalX;
          newY = currentY;
          newH = originalY + originalH - currentY;

          if (originalAspectRatio.value !== 0) {
            const newAspectRatio = newW / newH;
            if (newAspectRatio > originalAspectRatio.value) {
              newW = newH * originalAspectRatio.value;
            } else if (newAspectRatio < originalAspectRatio.value) {
              newH = newW / originalAspectRatio.value;
              newY = originalY + originalH - newH;
            }
          }
          break;
        }
        case 'bottomLeft': {
          newX = currentX;
          newW = originalX + originalW - currentX;
          newH = currentY - originalY;

          if (originalAspectRatio.value !== 0) {
            const newAspectRatio = newW / newH;
            if (newAspectRatio > originalAspectRatio.value) {
              newW = newH * originalAspectRatio.value;
              newX = originalX + originalW - newW;
            } else if (newAspectRatio < originalAspectRatio.value) {
              newH = newW / originalAspectRatio.value;
            }
          }
          break;
        }
        case 'bottomRight': {
          newW = currentX - originalX;
          newH = currentY - originalY;

          if (originalAspectRatio.value !== 0) {
            const newAspectRatio = newW / newH;
            if (newAspectRatio > originalAspectRatio.value) {
              newW = newH * originalAspectRatio.value;
            } else if (newAspectRatio < originalAspectRatio.value) {
              newH = newW / originalAspectRatio.value;
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
      if (newX + newW > canvasRef.value.width) { newW = canvasRef.value.width - newX; }
      if (newY + newH > canvasRef.value.height) { newH = canvasRef.value.height - newY; }
      targetBox.x = newX; targetBox.y = newY; targetBox.w = newW; targetBox.h = newH;
      if (slicingMode.value === 'custom') updatePreview();
    } else if (isMoving.value && targetBox) {
      let newX = currentX - offsetX.value;
      let newY = currentY - offsetY.value;
      newX = Math.max(0, Math.min(newX, canvasRef.value.width - targetBox.w));
      newY = Math.max(0, Math.min(newY, canvasRef.value.height - targetBox.h));
      targetBox.x = newX;
      targetBox.y = newY;
      if (slicingMode.value === 'custom') updatePreview();
    } else if (isDrawing.value) {
      const boxToDraw = slicingMode.value === 'custom' ? boxes.value[boxes.value.length - 1] : gridArea.value;
      if (boxToDraw) {
        boxToDraw.w = currentX - startX.value;
        boxToDraw.h = currentY - startY.value;
      }
    }

    if (isMoving.value || isDrawing.value || isResizing.value) {
      draw();
    }
  };

  const onMouseUp = () => {
    if (!sourceImage.value) return;
    let subjectBox: Box | null = null;
    if (slicingMode.value === 'custom' && (isDrawing.value || isResizing.value)) {
      subjectBox = boxes.value.find(b => b.id === selectedBoxId.value) || (isDrawing.value ? boxes.value[boxes.value.length - 1] : null);
    } else if (slicingMode.value === 'grid' && (isDrawing.value || isResizing.value)) {
      subjectBox = gridArea.value;
    }

    if (subjectBox) {
      if (subjectBox.w < 0) { subjectBox.x += subjectBox.w; subjectBox.w = -subjectBox.w; }
      if (subjectBox.h < 0) { subjectBox.y += subjectBox.h; subjectBox.h = -subjectBox.h; }
      if (subjectBox.w < 5 || subjectBox.h < 5) {
        if (slicingMode.value === 'custom') {
          if (isDrawing.value) boxes.value.pop();
          selectedBoxId.value = null;
        } else {
          gridArea.value = null;
        }
      } else {
        if (slicingMode.value === 'custom') {
          selectedBoxId.value = subjectBox.id;
          updatePreview();
        }
      }
    }

    isDrawing.value = false;
    isMoving.value = false;
    isResizing.value = false;
    activeAnchor.value = null;
    draw();
  };

  const onMouseLeave = () => {
    if (!sourceImage.value) return;
    if (isDrawing.value || isMoving.value || isResizing.value) {
      onMouseUp();
    }
  };

  const onRightClick = async (e: MouseEvent) => {
    if (slicingMode.value === 'grid') return;
    if (!canvasRef.value || !sourceImage.value) return;

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
      if (dropdownRef.value) {
        dropdownRef.value.handleOpen();
      }
    }
  };

  const handleCommand = (command: string) => {
    if (command === 'sendToBack') sendToBack();
    else if (command === 'deleteBox') deleteBox();
  };

  const sendToBack = () => {
    if (rightClickedBoxId.value === null) return;
    const index = boxes.value.findIndex(b => b.id === rightClickedBoxId.value);
    if (index !== -1) {
      const [box] = boxes.value.splice(index, 1);
      boxes.value.unshift(box);
      draw();
    }
    closeContextMenu();
  };

  const deleteBox = () => {
    if (rightClickedBoxId.value === null) return;
    const index = boxes.value.findIndex(b => b.id === rightClickedBoxId.value);
    if (index !== -1) {
      if (selectedBoxId.value === rightClickedBoxId.value) selectedBoxId.value = null;
      boxes.value.splice(index, 1);
      draw();
      updatePreview();
    }
    closeContextMenu();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!sourceImage.value) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (slicingMode.value === 'grid') {
        if (gridArea.value) {
          e.preventDefault();
          clearGrid();
        }
      } else if (slicingMode.value === 'custom') {
        if (selectedBoxId.value !== null) {
          e.preventDefault();
          const index = boxes.value.findIndex(b => b.id === selectedBoxId.value);
          if (index !== -1) {
            boxes.value.splice(index, 1);
            selectedBoxId.value = null;
            draw();
            updatePreview();
          }
        }
      }
    }
  };

  const handleClearAll = () => {
    if (slicingMode.value === 'custom') {
      if (boxes.value.length === 0) return;
      ElMessageBox.confirm('此操作将清除所有手动和自动生成的选框，是否继续？', '警告', {
        confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning',
      }).then(() => {
        boxes.value.length = 0;
        selectedBoxId.value = null;
        draw();
        updatePreview();
      }).catch(() => { });
    } else if (slicingMode.value === 'grid') {
      clearGrid();
    }
  };

  const handleAutoDetect = () => {
    const canvas = canvasRef.value;
    const ctx = ctxRef.value;
    if (!canvas || !ctx || !sourceImage.value) return;

    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    tempCanvas.width = sourceImage.value.width;
    tempCanvas.height = sourceImage.value.height;
    tempCtx.drawImage(sourceImage.value, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const { data, width, height } = imageData;
    const visited = new Uint8Array(width * height);
    const newBoxes: Box[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x);
        if (visited[index] || data[index * 4 + 3] === 0) continue;

        const queue: [number, number][] = [[x, y]];
        visited[index] = 1;
        let minX = x, minY = y, maxX = x, maxY = y;

        while (queue.length > 0) {
          const [curX, curY] = queue.shift()!;
          minX = Math.min(minX, curX); minY = Math.min(minY, curY);
          maxX = Math.max(maxX, curX); maxY = Math.max(maxY, curY);
          const neighbors = [[curX, curY - 1], [curX, curY + 1], [curX - 1, curY], [curX + 1, curY]];
          for (const [nx, ny] of neighbors) {
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const neighborIndex = (ny * width + nx);
              if (!visited[neighborIndex] && data[neighborIndex * 4 + 3] > 0) {
                visited[neighborIndex] = 1;
                queue.push([nx, ny]);
              }
            }
          }
        }
        const padding = autoDetectPadding.value;
        newBoxes.push({
          id: Date.now() + newBoxes.length,
          x: minX - padding + canvasPadding.value,
          y: minY - padding + canvasPadding.value,
          w: (maxX - minX + 1) + padding * 2,
          h: (maxY - minY + 1) + padding * 2
        });
      }
    }
    boxes.value = newBoxes;
    selectedBoxId.value = null;
    draw();
    updatePreview();
  };

  const handleExport = async () => {
    if (!sourceImage.value) {
      ElMessageBox.alert('没有可导出的内容，请先上传图片。', '提示', { type: 'warning' });
      return;
    }

    let boxesToExport: Box[] = [];

    if (slicingMode.value === 'custom') {
      if (boxes.value.length === 0) {
        ElMessageBox.alert('框选模式下没有选框可导出。', '提示', { type: 'warning' });
        return;
      }
      boxesToExport = boxes.value;
    } else if (slicingMode.value === 'grid') {
      if (!gridArea.value) {
        ElMessageBox.alert('网格模式下请先创建网格区域。', '提示', { type: 'warning' });
        return;
      }
      const { x, y, w, h } = gridArea.value;
      const cellWidth = w / gridCols.value;
      const cellHeight = h / gridRows.value;
      for (let i = 0; i < gridRows.value; i++) {
        for (let j = 0; j < gridCols.value; j++) {
          boxesToExport.push({
            id: i * gridCols.value + j,
            x: x + j * cellWidth,
            y: y + i * cellHeight,
            w: cellWidth,
            h: cellHeight,
          });
        }
      }
    }

    if (boxesToExport.length === 0) {
      ElMessageBox.alert('没有可导出的内容。', '提示', { type: 'warning' });
      return;
    }

    const zip = new JSZip();
    const img = sourceImage.value;

    for (const [index, box] of boxesToExport.entries()) {
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = box.w;
      tempCanvas.height = box.h;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) continue;

      const imageRect = { x: canvasPadding.value, y: canvasPadding.value, w: img.width, h: img.height };
      const intersectX = Math.max(box.x, imageRect.x);
      const intersectY = Math.max(box.y, imageRect.y);
      const intersectMaxX = Math.min(box.x + box.w, imageRect.x + imageRect.w);
      const intersectMaxY = Math.min(box.y + box.h, imageRect.y + imageRect.h);
      const intersectW = intersectMaxX - intersectX;
      const intersectH = intersectMaxY - intersectY;

      if (intersectW > 0 && intersectH > 0) {
        const sourceX = intersectX - canvasPadding.value;
        const sourceY = intersectY - canvasPadding.value;
        const destX = intersectX - box.x;
        const destY = intersectY - box.y;
        tempCtx.drawImage(img, sourceX, sourceY, intersectW, intersectH, destX, destY, intersectW, intersectH);
      }

      const blob = await new Promise<Blob | null>(resolve => tempCanvas.toBlob(resolve, 'image/png'));
      if (blob) {
        const filename = `${exportPrefix.value}${exportConnector.value}${index + 1}.png`;
        zip.file(filename, blob);
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(zipBlob);
    a.href = url;
    a.download = `${exportPrefix.value}.zip`;
    document.body.appendChild(a);
a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return {
    canvasRef,
    previewCanvasRef,
    sourceImage,
    boxes,
    selectedBoxId,
    isDrawing,
    isMoving,
    isResizing,
    startX,
    startY,
    offsetX,
    offsetY,
    activeAnchor,
    originalAspectRatio,
    cursorStyle,
    fileInputRef,
    slicingMode,
    gridRows,
    gridCols,
    gridArea,
    fitGridToImage,
    clearGrid,
    onCanvasPlaceholderClick,
    onFileSelected,
    onDrop,
    dropdownRef,
    isMenuVisible,
    menuTop,
    menuLeft,
    rightClickedBoxId,
    closeContextMenu,
    handleVisibleChange,
    canvasZoom,
    canvasPadding,
    autoDetectPadding,
    exportPrefix,
    exportConnector,
    fileNamePreview,
    draw,
    updatePreview,
    handleFileChange,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
    onRightClick,
    handleCommand,
    handleClearAll,
    handleAutoDetect,
    handleExport,
  };
}
